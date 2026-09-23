/**
 * Expense advanced filter catalog — align with backend ExpenseFilterFields.ALLOWED.
 */
export const EXPENSE_FILTER_CATALOG = [
  { field: "status", label: "Status", type: "enum" as const },
  { field: "category", label: "Category", type: "string" as const },
  { field: "projectId", label: "Project", type: "uuid" as const },
  { field: "resourceId", label: "Employee", type: "uuid" as const },
  { field: "regionId", label: "Region", type: "uuid" as const },
  { field: "billable", label: "Billable", type: "boolean" as const },
  { field: "expenseDate", label: "Expense date", type: "date" as const },
  { field: "amount", label: "Amount", type: "number" as const },
] as const;

export type ExpenseFilterCondition = {
  field: string;
  operator: string;
  value?: unknown;
  valueTo?: unknown;
};

export function buildExpenseFilterConditions(input: {
  status?: string;
  category?: string;
  projectId?: string;
  resourceId?: string;
  regionId?: string;
  billable?: boolean | "";
  expenseFrom?: string;
  expenseTo?: string;
}): ExpenseFilterCondition[] {
  const conditions: ExpenseFilterCondition[] = [];
  if (input.status) {
    conditions.push({ field: "status", operator: "EQ", value: input.status });
  }
  if (input.category?.trim()) {
    conditions.push({ field: "category", operator: "CONTAINS", value: input.category.trim() });
  }
  if (input.projectId) {
    conditions.push({ field: "projectId", operator: "EQ", value: input.projectId });
  }
  if (input.resourceId) {
    conditions.push({ field: "resourceId", operator: "EQ", value: input.resourceId });
  }
  if (input.regionId) {
    conditions.push({ field: "regionId", operator: "EQ", value: input.regionId });
  }
  if (input.billable === true || input.billable === false) {
    conditions.push({ field: "billable", operator: "EQ", value: input.billable });
  }
  if (input.expenseFrom && input.expenseTo) {
    conditions.push({
      field: "expenseDate",
      operator: "BETWEEN",
      value: input.expenseFrom,
      valueTo: input.expenseTo,
    });
  } else if (input.expenseFrom) {
    conditions.push({ field: "expenseDate", operator: "GTE", value: input.expenseFrom });
  } else if (input.expenseTo) {
    conditions.push({ field: "expenseDate", operator: "LTE", value: input.expenseTo });
  }
  return conditions;
}

export function needsExpenseQuery(filters: {
  category?: string;
  billable?: boolean | "";
  regionId?: string;
  expenseFrom?: string;
  expenseTo?: string;
}): boolean {
  return Boolean(
    filters.category ||
      filters.billable === true ||
      filters.billable === false ||
      filters.regionId ||
      filters.expenseFrom ||
      filters.expenseTo,
  );
}
