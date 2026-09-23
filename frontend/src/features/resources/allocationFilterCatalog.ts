/** Allocation advanced filter catalog — must match AllocationFilterFields.ALLOWED. */
export const ALLOCATION_FILTER_CATALOG = [
  { field: "projectId", label: "Project", type: "uuid" as const },
  { field: "resourceId", label: "Resource", type: "uuid" as const },
  { field: "status", label: "Status", type: "enum" as const },
] as const;
