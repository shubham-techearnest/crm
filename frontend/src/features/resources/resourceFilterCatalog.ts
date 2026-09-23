/** Resource advanced filter catalog — must match ResourceFilterFields.ALLOWED. */
export const RESOURCE_FILTER_CATALOG = [
  { field: "status", label: "Availability", type: "enum" as const },
  { field: "regionId", label: "Region", type: "uuid" as const, special: "CURRENT_REGION" as const },
  { field: "skillId", label: "Skill", type: "uuid" as const },
] as const;
