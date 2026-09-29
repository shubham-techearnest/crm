import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface PurchaseOrderItem {
  id: string;
  lineNo: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRateId: string | null;
  taxAmount: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: string;
  organizationId: string;
  regionId: string;
  vendorId: string;
  projectId: string | null;
  requesterId: string | null;
  poNumber: string | null;
  status: string;
  currencyCode: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  neededBy: string | null;
  notes: string | null;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export type CreatePurchaseOrderBody = {
  regionId: string;
  vendorId: string;
  projectId?: string;
  currencyCode?: string;
  neededBy?: string;
  notes?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRateId?: string;
  }>;
};

export type UpdatePurchaseOrderBody = {
  projectId?: string | null;
  poNumber?: string;
  currencyCode?: string;
  neededBy?: string | null;
  notes?: string | null;
};

export async function queryPurchaseOrders(body: {
  search?: string;
  filter?: { op: "AND" | "OR"; conditions: Array<{ field: string; operator: string; value?: unknown; valueTo?: unknown }> };
  status?: string;
  vendorId?: string;
  projectId?: string;
}): Promise<PurchaseOrder[]> {
  const { data } = await api.post<ApiResponse<PurchaseOrder[]>>("/purchase-orders/query", {
    ...body,
    page: 0,
    size: 100,
  });
  return unwrap(data);
}

export async function sendPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/send`);
  return unwrap(data);
}

export async function closePurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/close`);
  return unwrap(data);
}

export async function listPurchaseOrders(params?: {
  search?: string;
  status?: string;
  vendorId?: string;
  projectId?: string;
}): Promise<PurchaseOrder[]> {
  const { data } = await api.get<ApiResponse<PurchaseOrder[]>>("/purchase-orders", {
    params: {
      size: 100,
      search: params?.search || undefined,
      status: params?.status || undefined,
      vendorId: params?.vendorId || undefined,
      projectId: params?.projectId || undefined,
    },
  });
  return unwrap(data);
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`);
  return unwrap(data);
}

export async function createPurchaseOrder(body: CreatePurchaseOrderBody): Promise<PurchaseOrder> {
  const { data } = await api.post<ApiResponse<PurchaseOrder>>("/purchase-orders", body);
  return unwrap(data);
}

export async function updatePurchaseOrder(
  id: string,
  body: UpdatePurchaseOrderBody,
): Promise<PurchaseOrder> {
  const { data } = await api.put<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`, body);
  return unwrap(data);
}

export async function addPurchaseOrderItem(
  id: string,
  body: { description: string; quantity: number; unitPrice: number; taxRateId?: string },
): Promise<PurchaseOrder> {
  const { data } = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/items`, body);
  return unwrap(data);
}

export async function submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/submit`);
  return unwrap(data);
}

export async function approvePurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/approve`);
  return unwrap(data);
}

export async function rejectPurchaseOrder(
  id: string,
  body?: { reason?: string },
): Promise<PurchaseOrder> {
  const { data } = await api.post<ApiResponse<PurchaseOrder>>(
    `/purchase-orders/${id}/reject`,
    body ?? {},
  );
  return unwrap(data);
}
