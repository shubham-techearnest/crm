/** Skill advanced filter catalog — must match SkillFilterFields.ALLOWED. */
export const SKILL_FILTER_CATALOG = [
  { field: "name", label: "Name", type: "string" as const },
  { field: "category", label: "Category", type: "string" as const },
] as const;
