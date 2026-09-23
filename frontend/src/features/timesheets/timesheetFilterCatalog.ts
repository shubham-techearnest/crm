/** Timesheet advanced filter catalog — must match TimesheetFilterFields.ALLOWED. */
export const TIMESHEET_FILTER_CATALOG = [
  { field: "status", label: "Status", type: "enum" as const },
  { field: "weekStartDate", label: "Week start", type: "date" as const },
  { field: "resourceId", label: "Resource", type: "uuid" as const },
  { field: "billable", label: "Billable", type: "boolean" as const },
] as const;
