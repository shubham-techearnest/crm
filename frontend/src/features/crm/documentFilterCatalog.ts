/**
 * Document advanced filter catalog (whitelist — must match DocumentFilterFields.ALLOWED on server).
 */
export const DOCUMENT_FILTER_CATALOG = [
  { field: "entityType", label: "Entity type", type: "enum" as const },
  { field: "visibility", label: "Visibility", type: "enum" as const },
  { field: "uploadedBy", label: "Uploaded by", type: "uuid" as const, special: "CURRENT_USER" as const },
  { field: "createdAt", label: "Created", type: "datetime" as const },
] as const;

export type DocumentListFilters = {
  entityType?: string;
  visibility?: string;
  uploadedBy?: string;
  fromTs?: string;
  toTs?: string;
};
