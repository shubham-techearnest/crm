/**
 * Deal advanced filter catalog (whitelist — must match DealFilterFields.ALLOWED on server).
 */
export const DEAL_FILTER_CATALOG = [
  { field: "stage", label: "Stage", type: "enum" as const },
  { field: "value", label: "Value", type: "number" as const },
  { field: "expectedCloseDate", label: "Close date", type: "date" as const },
  { field: "accountId", label: "Account", type: "uuid" as const },
  { field: "ownerId", label: "Owner", type: "uuid" as const, special: "CURRENT_USER" as const },
] as const;

export type DealListFilters = {
  search?: string;
  accountId?: string;
  stage?: string;
  ownerId?: string;
  minValue?: string;
  closeFrom?: string;
  closeTo?: string;
};
