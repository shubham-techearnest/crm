import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

export type ImportFieldType =
  | "TEXT"
  | "EMAIL"
  | "PHONE"
  | "URL"
  | "INTEGER"
  | "DECIMAL"
  | "DATE"
  | "BOOLEAN"
  | "ENUM"
  | "REFERENCE";

/** A target field of a module, published by that module's importer (GET /imports/{module}/schema). */
export interface ImportFieldSpec {
  key: string;
  label: string;
  type: ImportFieldType;
  required: boolean;
  options: string[];
  maxLength: number | null;
  aliases: string[];
  /** For REFERENCE fields: what the value is looked up by, e.g. "Account name". */
  reference: string | null;
  metadataCode: string | null;
  /** Read only from the first row of a multi-row record (invoice / purchase order header). */
  groupHeader: boolean;
  /** Value the server uses when the cell is empty. */
  defaultValue: string | null;
}

export interface ImportSchema {
  module: string;
  metadataTable: string;
  usesRegion: boolean;
  groupKey: string | null;
  duplicateRule: string | null;
  maxRows: number;
  customFieldsSupported: boolean;
  fields: ImportFieldSpec[];
}

export interface BulkImportIssue {
  /** 0-based index into the submitted rows. */
  index: number;
  outcome: "SKIPPED" | "FAILED";
  reason: string;
}

export interface BulkImportResult {
  module: string;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  issues: BulkImportIssue[];
  dryRun: boolean;
}

interface ImportOptions {
  defaultRegionId?: string;
  skipDuplicates: boolean;
}

function unwrapResult<T>(data: ApiResponse<T>, fallback: string): T {
  if (!data.data) {
    throw new Error(data.message ?? fallback);
  }
  return data.data;
}

export async function getImportSchema(module: string): Promise<ImportSchema> {
  const { data } = await api.get<ApiResponse<ImportSchema>>(`/imports/${module}/schema`);
  return unwrapResult(data, "Could not load import fields");
}

function body(rows: Record<string, string>[], options: ImportOptions) {
  return {
    rows,
    defaultRegionId: options.defaultRegionId || null,
    skipDuplicates: options.skipDuplicates,
  };
}

/** Dry run: the server runs every check and rolls back, so nothing is saved. */
export async function validateModuleRows(
  module: string,
  rows: Record<string, string>[],
  options: ImportOptions,
): Promise<BulkImportResult> {
  const { data } = await api.post<ApiResponse<BulkImportResult>>(`/imports/${module}/validate`, body(rows, options));
  return unwrapResult(data, "Validation failed");
}

export async function importModuleRows(
  module: string,
  rows: Record<string, string>[],
  options: ImportOptions,
): Promise<BulkImportResult> {
  const { data } = await api.post<ApiResponse<BulkImportResult>>(`/imports/${module}`, body(rows, options));
  return unwrapResult(data, "Import failed");
}

/** A reusable mapping, saved per user and module. Column keys are normalised headers. */
export interface ImportMappingTemplate {
  name: string;
  /** normalised header → target field key, or IGNORE_COLUMN */
  columns: Record<string, string>;
  transforms: Record<string, string>;
  defaults: Record<string, string>;
  /** field key → (normalised imported value → option code) */
  valueMaps: Record<string, Record<string, string>>;
  savedAt: string;
}

export const IGNORE_COLUMN = "__ignore__";

/** Stored in the per-user preferences table (keyed by a short code), so no new storage is needed. */
function templatePrefKey(module: string): string {
  return `import_map_${module.replace(/[^a-z0-9]/gi, "_")}`;
}

export async function listImportTemplates(module: string): Promise<ImportMappingTemplate[]> {
  const { data } = await api.get<ApiResponse<{ tableCode: string; columns: unknown }>>(
    `/metadata/list-prefs/${templatePrefKey(module)}`,
  );
  const stored = data.data?.columns;
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (item): item is ImportMappingTemplate =>
      !!item && typeof item === "object" && typeof (item as ImportMappingTemplate).name === "string" &&
      typeof (item as ImportMappingTemplate).columns === "object",
  );
}

export async function saveImportTemplates(module: string, templates: ImportMappingTemplate[]): Promise<void> {
  const { data } = await api.put<ApiResponse<unknown>>(`/metadata/list-prefs/${templatePrefKey(module)}`, templates);
  if (data.success === false) {
    throw new Error(data.message ?? "Could not save the mapping template");
  }
}
