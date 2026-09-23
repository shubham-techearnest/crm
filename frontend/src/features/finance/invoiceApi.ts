import type { ApiResponse } from "@/types/api";
import api from "@/api/client";
import type { InvoiceFilterCondition } from "./invoiceFilterCatalog";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface InvoiceLine {
  id: string;
  lineNo: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRateId: string | null;
  taxAmount: number;
  projectId: string | null;
  timeEntryId: string | null;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  paidAt: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  organizationId: string;
  regionId: string;
  accountId: string;
  projectId: string | null;
  invoiceNumber: string | null;
  status: string;
  currencyCode: string;
  issueDate: string | null;
  dueDate: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  amountCredited: number;
  balanceDue: number;
  notes: string | null;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  creditNotes: CreditNote[];
  createdAt: string;
  updatedAt: string;
}

export interface CreditNote {
  id: string;
  organizationId: string;
  invoiceId: string;
  creditNumber: string | null;
  status: string;
  amount: number;
  reason: string | null;
  issueDate: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnbilledTimeEntry {
  id: string;
  projectId: string;
  workDate: string;
  hours: number;
  billingRate: number | null;
  description: string | null;
}

export async function listInvoices(params?: {
  search?: string;
  status?: string;
  accountId?: string;
  projectId?: string;
  overdueOnly?: boolean;
}): Promise<Invoice[]> {
  const { data } = await api.get<ApiResponse<Invoice[]>>("/invoices", {
    params: {
      size: 100,
      search: params?.search || undefined,
      status: params?.status || undefined,
      accountId: params?.accountId || undefined,
      projectId: params?.projectId || undefined,
      overdueOnly: params?.overdueOnly || undefined,
    },
  });
  return unwrap(data);
}

export async function queryInvoices(body: {
  filter?: { op: string; conditions: InvoiceFilterCondition[] };
  search?: string;
  status?: string;
  accountId?: string;
  projectId?: string;
  overdueOnly?: boolean;
}): Promise<Invoice[]> {
  const { data } = await api.post<ApiResponse<Invoice[]>>("/invoices/query", {
    ...body,
    page: 0,
    size: 100,
  });
  return unwrap(data);
}

export async function getInvoice(id: string): Promise<Invoice> {
  const { data } = await api.get<ApiResponse<Invoice>>(`/invoices/${id}`);
  return unwrap(data);
}

export async function createInvoice(body: {
  regionId: string;
  accountId: string;
  projectId?: string;
  currencyCode?: string;
  dueDate?: string;
  notes?: string;
}): Promise<Invoice> {
  const { data } = await api.post<ApiResponse<Invoice>>("/invoices", body);
  return unwrap(data);
}

export async function pullTimeIntoInvoice(
  id: string,
  body: { timeEntryIds: string[]; taxRateId?: string },
): Promise<Invoice> {
  const { data } = await api.post<ApiResponse<Invoice>>(`/invoices/${id}/lines/from-time`, body);
  return unwrap(data);
}

export async function addInvoiceLine(
  id: string,
  body: { description: string; quantity: number; unitPrice: number; taxRateId?: string },
): Promise<Invoice> {
  const { data } = await api.post<ApiResponse<Invoice>>(`/invoices/${id}/lines`, body);
  return unwrap(data);
}

export async function issueInvoice(id: string, body?: { issueDate?: string; dueDate?: string }): Promise<Invoice> {
  const { data } = await api.post<ApiResponse<Invoice>>(`/invoices/${id}/issue`, body ?? {});
  return unwrap(data);
}

export async function voidInvoice(id: string): Promise<Invoice> {
  const { data } = await api.post<ApiResponse<Invoice>>(`/invoices/${id}/void`);
  return unwrap(data);
}

export async function recordPayment(
  id: string,
  body: { amount: number; paidAt?: string; method?: string; reference?: string; notes?: string },
): Promise<Invoice> {
  const { data } = await api.post<ApiResponse<Invoice>>(`/invoices/${id}/payments`, body);
  return unwrap(data);
}

export async function listUnbilledTime(projectId?: string): Promise<UnbilledTimeEntry[]> {
  const { data } = await api.get<ApiResponse<UnbilledTimeEntry[]>>("/invoices/unbilled-time", {
    params: { projectId: projectId || undefined },
  });
  return unwrap(data);
}

export async function exportInvoicesCsv(): Promise<Blob> {
  const { data } = await api.get<Blob>("/invoices/export", { responseType: "blob" });
  return data;
}

export async function createCreditNote(
  invoiceId: string,
  body: { amount: number; reason?: string },
): Promise<CreditNote> {
  const { data } = await api.post<ApiResponse<CreditNote>>(`/invoices/${invoiceId}/credit-notes`, body);
  return unwrap(data);
}

export async function applyCreditNote(id: string): Promise<CreditNote> {
  const { data } = await api.post<ApiResponse<CreditNote>>(`/credit-notes/${id}/apply`);
  return unwrap(data);
}
