/** Project Task advanced filter catalog — must match TaskFilterFields.ALLOWED. */
export const TASK_FILTER_CATALOG = [
  { field: "status", label: "Status", type: "enum" as const },
  { field: "projectId", label: "Project", type: "uuid" as const },
  { field: "assignedResourceId", label: "Assignee", type: "uuid" as const },
  { field: "dueDate", label: "Due date", type: "date" as const },
  { field: "priority", label: "Priority", type: "enum" as const },
] as const;
