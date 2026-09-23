/** Milestone advanced filter catalog — must match MilestoneFilterFields.ALLOWED. */
export const MILESTONE_FILTER_CATALOG = [
  { field: "projectId", label: "Project", type: "uuid" as const },
  { field: "status", label: "Status", type: "enum" as const },
  { field: "dueDate", label: "Due date", type: "date" as const },
] as const;
