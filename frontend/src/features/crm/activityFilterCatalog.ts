/**
 * Activity advanced filter catalog (whitelist — must match ActivityFilterFields.ALLOWED on server).
 */
export const ACTIVITY_FILTER_CATALOG = [
  { field: "type", label: "Type", type: "enum" as const },
  { field: "status", label: "Status", type: "enum" as const },
  { field: "dueDate", label: "Due date", type: "datetime" as const },
  { field: "relatedEntityType", label: "Related type", type: "enum" as const },
  { field: "assignedTo", label: "Assignee", type: "uuid" as const, special: "CURRENT_USER" as const },
] as const;

export type ActivityListFilters = {
  type?: string;
  status?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  assignedTo?: string;
  dueFrom?: string;
  dueTo?: string;
};
