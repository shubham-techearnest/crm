import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface Vendor {
  id: string;
  organizationId: string;
  regionId: string;
  name: string;
  taxNumber: string | null;
  email: string | null;
  phone: string | null;
  accountId: string | null;
  paymentTermsDays: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateVendorBody = {
  regionId: string;
  name: string;
  taxNumber?: string;
  email?: string;
  phone?: string;
  accountId?: string;
  paymentTermsDays?: number;
  status?: string;
};

export type UpdateVendorBody = {
  regionId?: string;
  name?: string;
  taxNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  accountId?: string | null;
  paymentTermsDays?: number | null;
  status?: string;
};

export async function listVendors(params?: {
  search?: string;
  status?: string;
  regionId?: string;
}): Promise<Vendor[]> {
  const { data } = await api.get<ApiResponse<Vendor[]>>("/vendors", {
    params: {
      size: 100,
      search: params?.search || undefined,
      status: params?.status || undefined,
      regionId: params?.regionId || undefined,
    },
  });
  return unwrap(data);
}

export async function getVendor(id: string): Promise<Vendor> {
  const { data } = await api.get<ApiResponse<Vendor>>(`/vendors/${id}`);
  return unwrap(data);
}

export async function createVendor(body: CreateVendorBody): Promise<Vendor> {
  const { data } = await api.post<ApiResponse<Vendor>>("/vendors", body);
  return unwrap(data);
}

export async function updateVendor(id: string, body: UpdateVendorBody): Promise<Vendor> {
  const { data } = await api.put<ApiResponse<Vendor>>(`/vendors/${id}`, body);
  return unwrap(data);
}

export async function deleteVendor(id: string): Promise<void> {
  await api.delete(`/vendors/${id}`);
}
