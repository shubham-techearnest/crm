import type { ImportFieldSpec, ImportFieldType } from "./bulkImportApi";

export type CellStatus = "valid" | "converted" | "warning" | "error";

export interface CellResult {
  /** Value sent to the server; undefined when the cell is empty or invalid. */
  value?: string;
  status: CellStatus;
  message?: string;
}

export interface TransformOption {
  id: string;
  label: string;
}

const TYPE_LABEL: Record<ImportFieldType, string> = {
  TEXT: "Text",
  EMAIL: "Email",
  PHONE: "Phone",
  URL: "URL",
  INTEGER: "Integer",
  DECIMAL: "Decimal",
  DATE: "Date",
  BOOLEAN: "Boolean",
  ENUM: "Picklist",
  REFERENCE: "Reference",
};

export function typeLabel(type: ImportFieldType): string {
  return TYPE_LABEL[type] ?? type;
}

/** Spreadsheet cells arrive as text; these target types need an explicit conversion. */
export function requiresConversion(field: ImportFieldSpec): boolean {
  return ["INTEGER", "DECIMAL", "DATE", "BOOLEAN", "ENUM"].includes(field.type);
}

export function conversionLabel(field: ImportFieldSpec): string {
  if (field.type === "REFERENCE") return `Text → ${field.reference ?? "lookup"}`;
  return requiresConversion(field) ? `Text → ${typeLabel(field.type)}` : typeLabel(field.type);
}

const TRANSFORMS: Record<ImportFieldType, TransformOption[]> = {
  TEXT: [
    { id: "trim", label: "Trim spaces" },
    { id: "upper", label: "UPPERCASE" },
    { id: "lower", label: "lowercase" },
    { id: "title", label: "Title Case" },
    { id: "none", label: "Keep as is" },
  ],
  EMAIL: [{ id: "lower", label: "Trim + lowercase" }],
  PHONE: [
    { id: "keep", label: "Keep formatting" },
    { id: "digits", label: "Digits only (keep +)" },
    { id: "national10", label: "Last 10 digits (drop country code)" },
  ],
  URL: [
    { id: "trim", label: "Trim spaces" },
    { id: "https", label: "Add https:// when missing" },
  ],
  INTEGER: [
    { id: "strict", label: "Whole numbers only" },
    { id: "round", label: "Round decimals" },
  ],
  DECIMAL: [
    { id: "auto", label: "1,234.56 (dot decimal)" },
    { id: "comma", label: "1.234,56 (comma decimal)" },
  ],
  DATE: [
    { id: "auto", label: "Detect (DD/MM/YYYY for ambiguous)" },
    { id: "dmy", label: "DD/MM/YYYY" },
    { id: "mdy", label: "MM/DD/YYYY" },
    { id: "ymd", label: "YYYY-MM-DD" },
  ],
  BOOLEAN: [{ id: "auto", label: "Yes/No, Y/N, True/False, 1/0" }],
  ENUM: [{ id: "auto", label: "Match to picklist values" }],
  REFERENCE: [{ id: "trim", label: "Look up by name" }],
};

export function transformOptions(field: ImportFieldSpec): TransformOption[] {
  return TRANSFORMS[field.type] ?? TRANSFORMS.TEXT;
}

export function defaultTransform(field: ImportFieldSpec): string {
  return transformOptions(field)[0].id;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function convertDate(raw: string, mode: string): CellResult {
  const value = raw.trim();
  const withTime = value.match(/^(\d{4}-\d{1,2}-\d{1,2})[T\s]\d{1,2}:\d{2}/);
  const text = withTime ? withTime[1] : value;
  const timeNote = withTime ? "time of day dropped" : undefined;
  const ymd = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const other = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  let result: string | null = null;
  let warning = timeNote;
  if (ymd && (mode === "auto" || mode === "ymd")) {
    result = isoDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  } else if (other && mode !== "ymd") {
    const first = Number(other[1]);
    const second = Number(other[2]);
    const year = Number(other[3]);
    if (mode === "mdy") {
      result = isoDate(year, first, second);
    } else if (mode === "dmy") {
      result = isoDate(year, second, first);
    } else {
      if (first > 12) result = isoDate(year, second, first);
      else if (second > 12) result = isoDate(year, first, second);
      else {
        result = isoDate(year, second, first);
        if (first !== second) warning = "ambiguous day/month, read as DD/MM/YYYY";
      }
    }
  }
  if (!result) {
    return { status: "error", message: `"${raw}" is not a valid date` };
  }
  if (warning) return { value: result, status: "warning", message: warning };
  return { value: result, status: result === value ? "valid" : "converted" };
}

function convertNumber(raw: string, field: ImportFieldSpec, mode: string): CellResult {
  let cleaned = raw.replace(/[\s₹$€£]/g, "");
  if (mode === "comma") cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  else cleaned = cleaned.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { status: "error", message: `"${raw}" is not a valid number` };
  }
  let number = Number(cleaned);
  if (number < 0) return { status: "error", message: `${field.label} cannot be negative` };
  if (field.type === "INTEGER" && !Number.isInteger(number)) {
    if (mode !== "round") return { status: "error", message: `"${raw}" must be a whole number` };
    number = Math.round(number);
    return { value: String(number), status: "warning", message: `rounded ${cleaned} to ${number}` };
  }
  const value = String(number);
  return { value, status: value === raw.trim() ? "valid" : "converted" };
}

function convertPhone(raw: string, mode: string): CellResult {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (mode === "keep") return { value: trimmed, status: trimmed === raw ? "valid" : "converted" };
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6) return { status: "error", message: `"${raw}" does not look like a phone number` };
  const value = mode === "national10" ? digits.slice(-10) : `${trimmed.startsWith("+") ? "+" : ""}${digits}`;
  return { value, status: value === raw ? "valid" : "converted" };
}

function codeOf(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function normalizeEnumInput(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function convertEnum(raw: string, field: ImportFieldSpec, valueMap: Record<string, string> | undefined): CellResult {
  const mapped = valueMap?.[normalizeEnumInput(raw)];
  if (mapped && field.options.includes(mapped)) return { value: mapped, status: "converted" };
  const code = codeOf(raw);
  if (field.options.includes(code)) return { value: code, status: code === raw ? "valid" : "converted" };
  const loose = field.options.find((option) => normalizeEnumInput(option) === normalizeEnumInput(raw));
  if (loose) return { value: loose, status: "converted" };
  return {
    status: "error",
    message: `"${raw}" is not a valid ${field.label.toLowerCase()} (use ${field.options.join(", ")})`,
  };
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

/** Converts one non-empty cell to the value the server expects, using the chosen transformation. */
export function convertValue(
  raw: string,
  field: ImportFieldSpec,
  transform: string,
  valueMap?: Record<string, string>,
): CellResult {
  const trimmed = raw.trim();
  let result: CellResult;
  switch (field.type) {
    case "INTEGER":
    case "DECIMAL":
      result = convertNumber(trimmed, field, transform);
      break;
    case "DATE":
      result = convertDate(trimmed, transform);
      break;
    case "BOOLEAN": {
      const lowered = trimmed.toLowerCase();
      if (["true", "yes", "y", "1"].includes(lowered)) result = { value: "true", status: lowered === "true" ? "valid" : "converted" };
      else if (["false", "no", "n", "0"].includes(lowered)) result = { value: "false", status: lowered === "false" ? "valid" : "converted" };
      else result = { status: "error", message: `"${raw}" is not yes/no or true/false` };
      break;
    }
    case "ENUM":
      result = convertEnum(trimmed, field, valueMap);
      break;
    case "EMAIL": {
      const value = trimmed.toLowerCase();
      result = EMAIL.test(value)
        ? { value, status: value === raw ? "valid" : "converted" }
        : { status: "error", message: `"${raw}" is not a valid email address` };
      break;
    }
    case "PHONE":
      result = convertPhone(trimmed, transform);
      break;
    case "URL": {
      const value = transform === "https" && !/^[a-z]+:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
      result = { value, status: value === raw ? "valid" : "converted" };
      break;
    }
    default: {
      const value =
        transform === "upper"
          ? trimmed.toUpperCase()
          : transform === "lower"
            ? trimmed.toLowerCase()
            : transform === "title"
              ? titleCase(trimmed)
              : transform === "none"
                ? raw
                : trimmed.replace(/\s+/g, " ");
      result = { value, status: value === raw ? "valid" : "converted" };
    }
  }
  if (result.value !== undefined && field.maxLength && result.value.length > field.maxLength) {
    return { status: "error", message: `${field.label} is longer than ${field.maxLength} characters` };
  }
  return result;
}
