import type { BulkImportIssue, BulkImportResult, ImportFieldSpec, ImportSchema } from "./bulkImportApi";
import type { ColumnMapping } from "./fieldMatching";
import { convertValue, defaultTransform, normalizeEnumInput, requiresConversion, type CellResult } from "./valueTransforms";

export interface MappingDecisions {
  mappings: ColumnMapping[];
  /** field key → transformation id */
  transforms: Record<string, string>;
  /** field key → default used when the cell is empty or the field is not in the file */
  defaults: Record<string, string>;
  /** field key → (normalised imported value → picklist code) */
  valueMaps: Record<string, Record<string, string>>;
  defaultRegionId: string;
}

export interface PlannedCell {
  field: string;
  header: string | null;
  original: string;
  result: CellResult;
  fromDefault: boolean;
}

export interface PlannedRow {
  /** Row number as shown in the spreadsheet (header is row 1). */
  sourceRow: number;
  values: Record<string, string>;
  cells: PlannedCell[];
  errors: string[];
  warnings: string[];
}

export function transformFor(field: ImportFieldSpec, decisions: MappingDecisions): string {
  return decisions.transforms[field.key] ?? defaultTransform(field);
}

/** In region-scoped modules the region is effectively required: from a column or the default region. */
export function isEffectivelyRequired(field: ImportFieldSpec, schema: ImportSchema): boolean {
  return field.required || (schema.usesRegion && field.key === "region");
}

/** Everything the user must resolve on the mapping screen before validation can run. */
export function mappingBlockers(schema: ImportSchema, decisions: MappingDecisions): string[] {
  const blockers: string[] = [];
  const pending = decisions.mappings.filter((mapping) => mapping.status === "suggested");
  if (pending.length) {
    blockers.push(`Confirm or change ${pending.length} suggested mapping${pending.length === 1 ? "" : "s"}.`);
  }
  const undecided = decisions.mappings.filter((mapping) => mapping.status === "unmatched");
  if (undecided.length) {
    blockers.push(
      `Map or ignore ${undecided.length} unmatched column${undecided.length === 1 ? "" : "s"}: ${undecided
        .map((mapping) => mapping.header || `Column ${mapping.column + 1}`)
        .join(", ")}.`,
    );
  }
  const mapped = new Set(decisions.mappings.map((mapping) => mapping.target).filter(Boolean));
  schema.fields
    .filter((field) => isEffectivelyRequired(field, schema) && !mapped.has(field.key))
    .forEach((field) => {
      const resolved = field.key === "region" ? !!decisions.defaultRegionId : !!decisions.defaults[field.key]?.trim();
      if (!resolved) {
        blockers.push(
          field.key === "region"
            ? "Region is required: map a Region column or choose a default region."
            : `${field.label} is required: map a column to it or provide a default value.`,
        );
      }
    });
  return blockers;
}

function groupId(values: Record<string, string>, groupKey: string | null, rowIndex: number): string {
  const key = groupKey ? values[groupKey]?.trim().toLowerCase() : "";
  return key ? `g:${key}` : `r:${rowIndex}`;
}

/** Applies mapping, defaults and transformations to every data row and checks it on the client side. */
export function buildImportPlan(dataRows: string[][], schema: ImportSchema, decisions: MappingDecisions): PlannedRow[] {
  const columnByField = new Map<string, ColumnMapping>();
  decisions.mappings.forEach((mapping) => {
    if (mapping.target && (mapping.status === "matched" || mapping.status === "suggested")) {
      columnByField.set(mapping.target, mapping);
    }
  });
  const seenGroups = new Set<string>();
  const groupOf = new Map<PlannedRow, string>();
  const planned: PlannedRow[] = [];

  dataRows.forEach((row, rowIndex) => {
    if (!row.some((cell) => cell?.trim())) return;
    const values: Record<string, string> = {};
    const cells: PlannedCell[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    schema.fields.forEach((field) => {
      const mapping = columnByField.get(field.key);
      const cell = mapping ? (row[mapping.column] ?? "") : "";
      const defaultValue = decisions.defaults[field.key] ?? "";
      const fromDefault = !cell.trim() && !!defaultValue.trim();
      const original = fromDefault ? defaultValue : cell;
      if (!original.trim()) return;
      const result = convertValue(original, field, transformFor(field, decisions), decisions.valueMaps[field.key]);
      cells.push({ field: field.key, header: mapping?.header ?? null, original, result, fromDefault });
      if (result.status === "error") {
        errors.push(`${field.label}: ${result.message}`);
      } else {
        values[field.key] = result.value ?? "";
        if (result.status === "warning") warnings.push(`${field.label}: ${result.message}`);
      }
    });

    const group = groupId(values, schema.groupKey, rowIndex);
    const firstInGroup = !seenGroups.has(group);
    seenGroups.add(group);
    schema.fields
      .filter((field) => field.required && !values[field.key])
      .filter((field) => !field.groupHeader || firstInGroup)
      .filter((field) => !errors.some((error) => error.startsWith(`${field.label}:`)))
      .forEach((field) => errors.push(`${field.label} is required`));
    if (schema.usesRegion && !values.region && !decisions.defaultRegionId && firstInGroup) {
      errors.push("Region is required (add a Region value or choose a default region)");
    }

    planned.push({ sourceRow: rowIndex + 2, values, cells, errors, warnings });
    groupOf.set(planned[planned.length - 1], group);
  });

  if (schema.groupKey) {
    const failedRowByGroup = new Map<string, number>();
    planned.forEach((row) => {
      const group = groupOf.get(row)!;
      if (row.errors.length && !failedRowByGroup.has(group)) failedRowByGroup.set(group, row.sourceRow);
    });
    planned.forEach((row) => {
      const failedRow = failedRowByGroup.get(groupOf.get(row)!);
      if (failedRow && !row.errors.length) {
        row.errors.push(`Row ${failedRow} of the same record has errors, so this record is not imported`);
      }
    });
  }
  return planned;
}

/** Distinct values in a mapped picklist column that do not match any option (for the value-mapping editor). */
export function unrecognizedEnumValues(
  dataRows: string[][],
  column: number,
  field: ImportFieldSpec,
  valueMap: Record<string, string> | undefined,
): string[] {
  const seen = new Map<string, string>();
  dataRows.forEach((row) => {
    const raw = row[column]?.trim();
    if (!raw) return;
    const normalized = normalizeEnumInput(raw);
    if (seen.has(normalized) || valueMap?.[normalized]) return;
    const result = convertValue(raw, field, "auto");
    if (result.status === "error") seen.set(normalized, raw);
  });
  return [...seen.values()];
}

export type RowOutcome = "valid" | "warning" | "duplicate" | "invalid";

export interface ReviewedRow {
  row: PlannedRow;
  outcome: RowOutcome;
  /** Errors, duplicate reason and warnings, in that order. */
  messages: string[];
}

/**
 * Combines client-side checks with the server dry run. `sent` are the rows submitted to validation, in order,
 * so server issue indexes point into it.
 */
export function classifyRows(plan: PlannedRow[], sent: PlannedRow[], dryRun: BulkImportResult | null): ReviewedRow[] {
  const serverIssues = new Map<PlannedRow, BulkImportIssue[]>();
  dryRun?.issues.forEach((issue) => {
    const row = sent[issue.index];
    if (row) serverIssues.set(row, [...(serverIssues.get(row) ?? []), issue]);
  });
  return plan.map((row) => {
    const issues = serverIssues.get(row) ?? [];
    const failed = issues.filter((issue) => issue.outcome === "FAILED").map((issue) => issue.reason);
    const skipped = issues.filter((issue) => issue.outcome === "SKIPPED").map((issue) => issue.reason);
    const errors = [...row.errors, ...failed];
    if (errors.length) return { row, outcome: "invalid", messages: [...errors, ...row.warnings] };
    if (skipped.length) return { row, outcome: "duplicate", messages: [...skipped, ...row.warnings] };
    if (row.warnings.length) return { row, outcome: "warning", messages: row.warnings };
    return { row, outcome: "valid", messages: [] };
  });
}

export interface MappingSummary {
  mapped: number;
  unmatched: number;
  ignored: number;
  created: number;
  conversions: number;
}

export function summarizeMapping(schema: ImportSchema, decisions: MappingDecisions): MappingSummary {
  const fields = new Map(schema.fields.map((field) => [field.key, field]));
  const mapped = decisions.mappings.filter((mapping) => mapping.target && mapping.status === "matched");
  return {
    mapped: mapped.length,
    unmatched: decisions.mappings.filter((mapping) => mapping.autoUnmatched).length,
    ignored: decisions.mappings.filter((mapping) => mapping.status === "ignored").length,
    created: 0,
    conversions: mapped.filter((mapping) => {
      const field = fields.get(mapping.target!);
      return !!field && requiresConversion(field);
    }).length,
  };
}
