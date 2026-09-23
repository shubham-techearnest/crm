export const CONTRACT_FILTER_CATALOG = [
  { field: "status", label: "Status", type: "enum" as const },
  { field: "accountId", label: "Account", type: "uuid" as const },
  { field: "autoRenew", label: "Auto renew", type: "boolean" as const },
  { field: "endDate", label: "End date", type: "date" as const },
] as const;

export type ContractFilterCondition = {
  field: string;
  operator: string;
  value?: unknown;
  valueTo?: unknown;
};

export function buildContractFilterConditions(input: {
  status?: string;
  accountId?: string;
  autoRenew?: boolean | "";
  expiryWithinDays?: string;
}): ContractFilterCondition[] {
  const conditions: ContractFilterCondition[] = [];
  if (input.status) {
    conditions.push({ field: "status", operator: "EQ", value: input.status });
  }
  if (input.accountId) {
    conditions.push({ field: "accountId", operator: "EQ", value: input.accountId });
  }
  if (input.autoRenew === true || input.autoRenew === false) {
    conditions.push({ field: "autoRenew", operator: "EQ", value: input.autoRenew });
  }
  if (input.expiryWithinDays?.trim()) {
    const days = Number(input.expiryWithinDays);
    if (Number.isFinite(days) && days >= 0) {
      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + days);
      conditions.push({
        field: "endDate",
        operator: "BETWEEN",
        value: today.toISOString().slice(0, 10),
        valueTo: end.toISOString().slice(0, 10),
      });
    }
  }
  return conditions;
}

export function needsContractQuery(filters: {
  expiryWithinDays?: string;
  autoRenew?: boolean | "";
}): boolean {
  return Boolean(filters.expiryWithinDays || filters.autoRenew === true || filters.autoRenew === false);
}
