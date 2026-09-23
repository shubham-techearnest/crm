/** Project advanced filter catalog — must match ProjectFilterFields.ALLOWED. */
export const PROJECT_FILTER_CATALOG = [
  { field: "status", label: "Status", type: "enum" as const },
  { field: "accountId", label: "Account", type: "uuid" as const },
  { field: "projectManagerId", label: "Manager", type: "uuid" as const, special: "CURRENT_USER" as const },
  { field: "startDate", label: "Start date", type: "date" as const },
  { field: "endDate", label: "End date", type: "date" as const },
] as const;
