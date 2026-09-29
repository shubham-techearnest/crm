import type { CreateLeadBody } from "./crmApi";
import { parseCsv } from "@/utils/csvParse";

export const MAX_IMPORT_ROWS = 2000;

export const LEAD_IMPORT_FIELD_OPTIONS = [
  { key: "", label: "— Skip column —" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "companyName", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "mobile", label: "Mobile" },
  { key: "website", label: "Website" },
  { key: "source", label: "Lead source" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "industry", label: "Industry" },
  { key: "designation", label: "Designation" },
  { key: "noOfEmployees", label: "No. of employees" },
  { key: "estimatedValue", label: "Estimated value" },
  { key: "expectedCloseDate", label: "Expected close date" },
  { key: "addressCity", label: "City" },
  { key: "addressState", label: "State" },
  { key: "addressCountry", label: "Country" },
  { key: "addressZip", label: "Zip / postal code" },
  { key: "description", label: "Description" },
] as const;

const HEADER_GUESSES: Record<string, string> = {
  firstname: "firstName",
  fname: "firstName",
  lastname: "lastName",
  lname: "lastName",
  surname: "lastName",
  company: "companyName",
  companyname: "companyName",
  organization: "companyName",
  organisation: "companyName",
  email: "email",
  emailaddress: "email",
  phone: "phone",
  phonenumber: "phone",
  mobile: "mobile",
  mobilenumber: "mobile",
  website: "website",
  source: "source",
  leadsource: "source",
  status: "status",
  leadstatus: "status",
  priority: "priority",
  industry: "industry",
  designation: "designation",
  title: "designation",
  jobtitle: "designation",
  employees: "noOfEmployees",
  noofemployees: "noOfEmployees",
  estimatedvalue: "estimatedValue",
  value: "estimatedValue",
  amount: "estimatedValue",
  expectedclosedate: "expectedCloseDate",
  closedate: "expectedCloseDate",
  city: "addressCity",
  state: "addressState",
  country: "addressCountry",
  zip: "addressZip",
  zipcode: "addressZip",
  postalcode: "addressZip",
  pincode: "addressZip",
  description: "description",
  notes: "description",
};

export function guessMapping(header: string): string {
  const normalized = header.trim().toLowerCase().replace(/[\s_\-.]+/g, "");
  return HEADER_GUESSES[normalized] ?? "";
}

/** Template columns use headers that {@link guessMapping} recognises. */
const TEMPLATE_HEADERS = [
  "First name",
  "Last name",
  "Company",
  "Email",
  "Phone",
  "Lead source",
  "Status",
  "Priority",
  "Industry",
  "Designation",
  "Estimated value",
  "Expected close date",
  "City",
  "Country",
  "Description",
];

const TEMPLATE_SAMPLE = [
  "Asha",
  "Patil",
  "Acme Industries",
  "asha.patil@example.com",
  "+91 98765 43210",
  "Website",
  "NEW",
  "HIGH",
  "Manufacturing",
  "Purchase Manager",
  "250000",
  "2026-12-31",
  "Pune",
  "India",
  "Met at trade fair",
];

export function leadImportTemplateCsv(): string {
  const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [TEMPLATE_HEADERS, TEMPLATE_SAMPLE].map((row) => row.map(quote).join(",")).join("\r\n") + "\r\n";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return "";
    return `${cell.getUTCFullYear()}-${pad(cell.getUTCMonth() + 1)}-${pad(cell.getUTCDate())}`;
  }
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  return String(cell).trim();
}

export class UnsupportedFileError extends Error {}

/** Reads the first sheet of an .xlsx workbook, or a .csv file, into trimmed string cells. */
export async function readSpreadsheetFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const sheet = await readSheet(file);
    return (sheet as unknown[][])
      .map((row) => row.map(cellToString))
      .filter((row) => row.some((cell) => cell.length > 0));
  }
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    return parseCsv(text.replace(/^\uFEFF/, ""));
  }
  throw new UnsupportedFileError("Only .xlsx and .csv files are supported. Save .xls files as .xlsx first.");
}

/** Accepts yyyy-mm-dd, yyyy/mm/dd, dd-mm-yyyy and dd/mm/yyyy. */
export function normalizeDate(raw: string): string | null {
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (dmy) {
    [day, month, year] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function normalizeNumber(raw: string): number | null {
  const cleaned = raw.replace(/[,\s₹$€£]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export interface PreparedLeadRow {
  /** 1-based row number as shown in the spreadsheet (header is row 1). */
  sourceRow: number;
  body: CreateLeadBody;
}

export interface RowProblem {
  sourceRow: number;
  reason: string;
}

export interface PreparedImport {
  rows: PreparedLeadRow[];
  problems: RowProblem[];
}

export function prepareLeadRows(dataRows: string[][], mappings: string[], regionId: string): PreparedImport {
  const rows: PreparedLeadRow[] = [];
  const problems: RowProblem[] = [];

  dataRows.forEach((row, rowIndex) => {
    const sourceRow = rowIndex + 2;
    if (!row.some((cell) => cell.trim())) return;

    const body: CreateLeadBody = { regionId };
    const values = body as unknown as Record<string, string | number | undefined>;
    const rowProblems: string[] = [];

    mappings.forEach((field, columnIndex) => {
      if (!field) return;
      const raw = row[columnIndex]?.trim();
      if (!raw) return;
      if (field === "estimatedValue" || field === "noOfEmployees") {
        const value = normalizeNumber(raw);
        if (value === null) {
          rowProblems.push(`"${raw}" is not a valid number`);
          return;
        }
        values[field] = field === "noOfEmployees" ? Math.trunc(value) : value;
        return;
      }
      if (field === "expectedCloseDate") {
        const value = normalizeDate(raw);
        if (!value) {
          rowProblems.push(`"${raw}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)`);
          return;
        }
        values[field] = value;
        return;
      }
      if (field === "status" || field === "priority") {
        values[field] = raw.toUpperCase().replace(/\s+/g, "_");
        return;
      }
      values[field] = raw;
    });

    if (rowProblems.length) {
      problems.push({ sourceRow, reason: rowProblems.join("; ") });
      return;
    }
    rows.push({ sourceRow, body });
  });

  return { rows, problems };
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
