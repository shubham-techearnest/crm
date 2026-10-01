import api from "@/api/client";
import type { ApiResponse } from "@/types/api";

export type CustomFieldAccess = "READ" | "WRITE";
export type CustomFieldValue = string | number | boolean | null;
export type CustomFieldValues = Record<string, CustomFieldValue>;

export interface CustomFieldDefinition {
  code: string;
  label: string;
  helpText: string | null;
  fieldType: string;
  mandatory: boolean;
  defaultValue: string | null;
  referenceTableCode: string | null;
  options: string[];
  sortOrder: number;
  access: CustomFieldAccess;
}

export interface CustomFieldSection {
  id: string;
  title: string;
  disclosure: string;
  fields: string[];
}

export interface CustomFieldSchema {
  tableCode: string;
  fields: CustomFieldDefinition[];
  sections: CustomFieldSection[];
}

export const customFieldKeys = {
  schema: (tableCode: string, layoutKey: string) => ["custom-fields", "schema", tableCode, layoutKey] as const,
  values: (tableCode: string, recordId: string) => ["custom-fields", "values", tableCode, recordId] as const,
  valuesForTable: (tableCode: string) => ["custom-fields", "values", tableCode] as const,
  batch: (tableCode: string, ids: string[]) => ["custom-fields", "values", tableCode, "batch", ids.join(",")] as const,
};

export async function getCustomFieldSchema(tableCode: string, layoutKey: "CREATE" | "EDIT" = "CREATE"): Promise<CustomFieldSchema> {
  const { data } = await api.get<ApiResponse<CustomFieldSchema>>(`/custom-fields/${tableCode}/schema`, {
    params: { layoutKey },
  });
  return data.data ?? { tableCode, fields: [], sections: [] };
}

export async function getCustomFieldValues(tableCode: string, recordId: string): Promise<CustomFieldValues> {
  const { data } = await api.get<ApiResponse<{ recordId: string; values: CustomFieldValues }>>(
    `/custom-fields/${tableCode}/records/${recordId}`,
  );
  return data.data?.values ?? {};
}

export async function saveCustomFieldValues(
  tableCode: string,
  recordId: string,
  values: CustomFieldValues,
): Promise<CustomFieldValues> {
  const { data } = await api.put<ApiResponse<{ recordId: string; values: CustomFieldValues }>>(
    `/custom-fields/${tableCode}/records/${recordId}`,
    { values },
  );
  return data.data?.values ?? {};
}

export async function queryCustomFieldValues(
  tableCode: string,
  recordIds: string[],
): Promise<Record<string, CustomFieldValues>> {
  if (!recordIds.length) return {};
  const { data } = await api.post<ApiResponse<{ recordId: string; values: CustomFieldValues }[]>>(
    `/custom-fields/${tableCode}/records/query`,
    { recordIds },
  );
  const out: Record<string, CustomFieldValues> = {};
  for (const row of data.data ?? []) out[row.recordId] = row.values ?? {};
  return out;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRecordId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function formatCustomFieldValue(field: Pick<CustomFieldDefinition, "fieldType">, value: CustomFieldValue | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  switch (field.fieldType) {
    case "BOOLEAN":
      return value === true || value === "true" ? "Yes" : "No";
    case "DATE": {
      const date = new Date(`${String(value)}T00:00:00`);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
    }
    case "DATETIME": {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }
    case "NUMBER":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    default:
      return String(value);
  }
}
