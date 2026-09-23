/**
 * Account advanced filter catalog (whitelist — must match AccountFilterFields.ALLOWED on server).
 */
export const ACCOUNT_FILTER_CATALOG = [
  { field: "accountType", label: "Type", type: "enum" as const },
  { field: "status", label: "Status", type: "enum" as const },
  { field: "industry", label: "Industry", type: "string" as const },
  { field: "regionId", label: "Region", type: "uuid" as const, special: "CURRENT_REGION" as const },
  { field: "ownerId", label: "Owner", type: "uuid" as const, special: "CURRENT_USER" as const },
] as const;

export type AccountListFilters = {
  search?: string;
  status?: string;
  accountType?: string;
  industry?: string;
  regionId?: string;
};
