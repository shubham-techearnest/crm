import type { ApiResponse } from "@/types/api";
import api from "@/api/client";
import type { ExpenseFilterCondition } from "./expenseFilterCatalog";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

/** Matches backend ExpenseDtos.ExpenseResponse (header-level expense). */
export interface Expense {
  id: string;
  organizationId: string;
  regionId: string;
  resourceId: string | null;
  projectId: string | null;
  purchaseOrderId: string | null;
  category: string;
  description: string | null;
  amount: number;
  currencyCode: string;
  expenseDate: string;
  billable: boolean;
  status: string;
  approvalRequestId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateExpenseBody = {
  regionId: string;
  resourceId?: string;
  projectId?: string;
  category: string;
  description?: string;
  amount: number;
  currencyCode?: string;
  expenseDate: string;
  billable?: boolean;
  notes?: string;
};

export type UpdateExpenseBody = {
  resourceId?: string | null;
  projectId?: string | null;
  category?: string;
  description?: string | null;
  amount?: number;
  currencyCode?: string;
  expenseDate?: string;
  billable?: boolean;
  notes?: string | null;
};

export async function listExpenses(params?: {
  search?: string;
  status?: string;
  category?: string;
  projectId?: string;
  resourceId?: string;
  billable?: boolean;
}): Promise<Expense[]> {
  const { data } = await api.get<ApiResponse<Expense[]>>("/expenses", {
    params: {
      size: 100,
      search: params?.search || undefined,
      status: params?.status || undefined,
      category: params?.category || undefined,
      projectId: params?.projectId || undefined,
      resourceId: params?.resourceId || undefined,
      billable: params?.billable,
    },
  });
  return unwrap(data);
}

export async function queryExpenses(body: {
  search?: string;
  filter?: { op: "AND" | "OR"; conditions: ExpenseFilterCondition[] };
  status?: string;
  category?: string;
  projectId?: string;
  resourceId?: string;
  billable?: boolean;
}): Promise<Expense[]> {
  const { data } = await api.post<ApiResponse<Expense[]>>("/expenses/query", {
    ...body,
    page: 0,
    size: 100,
  });
  return unwrap(data);
}

export async function getExpense(id: string): Promise<Expense> {
  const { data } = await api.get<ApiResponse<Expense>>(`/expenses/${id}`);
  return unwrap(data);
}

export async function createExpense(body: CreateExpenseBody): Promise<Expense> {
  const { data } = await api.post<ApiResponse<Expense>>("/expenses", body);
  return unwrap(data);
}

export async function updateExpense(id: string, body: UpdateExpenseBody): Promise<Expense> {
  const { data } = await api.put<ApiResponse<Expense>>(`/expenses/${id}`, body);
  return unwrap(data);
}

export async function submitExpense(id: string): Promise<Expense> {
  const { data } = await api.post<ApiResponse<Expense>>(`/expenses/${id}/submit`);
  return unwrap(data);
}

export async function approveExpense(id: string): Promise<Expense> {
  const { data } = await api.post<ApiResponse<Expense>>(`/expenses/${id}/approve`);
  return unwrap(data);
}

export async function rejectExpense(id: string, body?: { reason?: string }): Promise<Expense> {
  const { data } = await api.post<ApiResponse<Expense>>(`/expenses/${id}/reject`, {
    reason: body?.reason || "Rejected",
  });
  return unwrap(data);
}
