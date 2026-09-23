/**
 * Invoice advanced filter catalog — must match InvoiceFilterFields.ALLOWED.
 */
export const INVOICE_FILTER_CATALOG = [
  { field: "status", label: "Status", type: "enum" as const },
  { field: "accountId", label: "Account", type: "uuid" as const },
  { field: "projectId", label: "Project", type: "uuid" as const },
  { field: "regionId", label: "Region", type: "uuid" as const },
  { field: "dueDate", label: "Due date", type: "date" as const },
  { field: "balanceDue", label: "Balance due", type: "number" as const },
  { field: "issueDate", label: "Issue date", type: "date" as const },
] as const;

export type InvoiceFilterCondition = {
  field: string;
  operator: string;
  value?: unknown;
  valueTo?: unknown;
};

export function buildInvoiceFilterConditions(input: {
  status?: string;
  accountId?: string;
  projectId?: string;
  regionId?: string;
  dueFrom?: string;
  dueTo?: string;
  minBalance?: string;
  overdueOnly?: boolean;
}): InvoiceFilterCondition[] {
  const conditions: InvoiceFilterCondition[] = [];
  if (input.status) {
    conditions.push({ field: "status", operator: "EQ", value: input.status });
  }
  if (input.accountId) {
    conditions.push({ field: "accountId", operator: "EQ", value: input.accountId });
  }
  if (input.projectId) {
    conditions.push({ field: "projectId", operator: "EQ", value: input.projectId });
  }
  if (input.regionId) {
    conditions.push({ field: "regionId", operator: "EQ", value: input.regionId });
  }
  if (input.minBalance?.trim()) {
    conditions.push({ field: "balanceDue", operator: "GTE", value: Number(input.minBalance) });
  }
  if (input.dueFrom && input.dueTo) {
    conditions.push({
      field: "dueDate",
      operator: "BETWEEN",
      value: input.dueFrom,
      valueTo: input.dueTo,
    });
  } else if (input.dueFrom) {
    conditions.push({ field: "dueDate", operator: "GTE", value: input.dueFrom });
  } else if (input.dueTo) {
    conditions.push({ field: "dueDate", operator: "LTE", value: input.dueTo });
  }
  if (input.overdueOnly) {
    const today = new Date().toISOString().slice(0, 10);
    conditions.push({ field: "dueDate", operator: "LT", value: today });
    conditions.push({ field: "balanceDue", operator: "GT", value: 0 });
    conditions.push({
      field: "status",
      operator: "NE",
      value: "VOID",
    });
  }
  return conditions;
}

export function needsInvoiceQuery(filters: {
  dueFrom?: string;
  dueTo?: string;
  minBalance?: string;
  regionId?: string;
  overdueOnly?: boolean;
}): boolean {
  return Boolean(
    filters.dueFrom || filters.dueTo || filters.minBalance || filters.regionId || filters.overdueOnly,
  );
}
