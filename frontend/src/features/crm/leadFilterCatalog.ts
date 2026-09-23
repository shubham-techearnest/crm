/**
 * Lead advanced filter catalog (whitelist — must match LeadFilterFields.ALLOWED on server).
 * Operators: EQ, NE, CONTAINS, GT/GTE/LT/LTE, BETWEEN, IS_EMPTY, IS_NOT_EMPTY, IN.
 */
export const LEAD_FILTER_CATALOG = [
  { field: "status", label: "Status", type: "enum" as const },
  { field: "source", label: "Source", type: "string" as const },
  { field: "priority", label: "Priority", type: "enum" as const },
  { field: "ownerId", label: "Owner", type: "uuid" as const, special: "CURRENT_USER" as const },
  { field: "regionId", label: "Region", type: "uuid" as const, special: "CURRENT_REGION" as const },
  { field: "estimatedValue", label: "Est. value", type: "number" as const },
  { field: "createdAt", label: "Created", type: "datetime" as const },
  { field: "status", label: "Unconverted", type: "special" as const, special: "UNCONVERTED" as const },
] as const;

export type LeadFilterCondition = {
  field: string;
  operator: string;
  value?: unknown;
  valueTo?: unknown;
};

export function buildLeadFilterConditions(input: {
  status?: string;
  source?: string;
  priority?: string;
  regionId?: string;
  ownerId?: string;
  minValue?: string;
  createdFrom?: string;
  createdTo?: string;
  unconvertedOnly?: boolean;
}): LeadFilterCondition[] {
  const conditions: LeadFilterCondition[] = [];
  if (input.unconvertedOnly) {
    conditions.push({ field: "status", operator: "NE", value: "CONVERTED" });
  } else if (input.status) {
    conditions.push({ field: "status", operator: "EQ", value: input.status });
  }
  if (input.source?.trim()) {
    conditions.push({ field: "source", operator: "EQ", value: input.source.trim() });
  }
  if (input.priority) {
    conditions.push({ field: "priority", operator: "EQ", value: input.priority });
  }
  if (input.regionId) {
    conditions.push({ field: "regionId", operator: "EQ", value: input.regionId });
  }
  if (input.ownerId) {
    conditions.push({ field: "ownerId", operator: "EQ", value: input.ownerId });
  }
  if (input.minValue?.trim()) {
    conditions.push({ field: "estimatedValue", operator: "GTE", value: Number(input.minValue) });
  }
  if (input.createdFrom && input.createdTo) {
    conditions.push({
      field: "createdAt",
      operator: "BETWEEN",
      value: new Date(input.createdFrom).toISOString(),
      valueTo: new Date(`${input.createdTo}T23:59:59.999Z`).toISOString(),
    });
  } else if (input.createdFrom) {
    conditions.push({
      field: "createdAt",
      operator: "GTE",
      value: new Date(input.createdFrom).toISOString(),
    });
  } else if (input.createdTo) {
    conditions.push({
      field: "createdAt",
      operator: "LTE",
      value: new Date(`${input.createdTo}T23:59:59.999Z`).toISOString(),
    });
  }
  return conditions;
}

export function needsLeadQuery(filters: {
  ownerId?: string;
  minValue?: string;
  createdFrom?: string;
  createdTo?: string;
  unconvertedOnly?: boolean;
}): boolean {
  return Boolean(
    filters.ownerId ||
      filters.minValue?.trim() ||
      filters.createdFrom ||
      filters.createdTo ||
      filters.unconvertedOnly,
  );
}
