import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  timezone: string;
  locale: string;
  currencyCode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userCount?: number | null;
  regionCount?: number | null;
}

export interface ProvisionOrganizationBody {
  name: string;
  slug: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  timezone: string;
  locale: string;
  currencyCode: string;
  defaultRegionName: string;
  defaultRegionCode: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export async function listPlatformOrganizations(params?: {
  search?: string;
  status?: string;
  page?: number;
  size?: number;
}): Promise<{ items: PlatformOrganization[]; total: number }> {
  const { data } = await api.get<ApiResponse<PlatformOrganization[]>>("/platform/organizations", {
    params: { size: 100, ...params },
  });
  return {
    items: unwrap(data),
    total: data.pagination?.totalElements ?? unwrap(data).length,
  };
}

export async function getPlatformOrganization(id: string): Promise<PlatformOrganization> {
  const { data } = await api.get<ApiResponse<PlatformOrganization>>(`/platform/organizations/${id}`);
  return unwrap(data);
}

export async function provisionPlatformOrganization(
  body: ProvisionOrganizationBody,
): Promise<PlatformOrganization> {
  const { data } = await api.post<ApiResponse<PlatformOrganization>>("/platform/organizations", body);
  return unwrap(data);
}

export async function setPlatformOrganizationStatus(
  id: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<PlatformOrganization> {
  const { data } = await api.put<ApiResponse<PlatformOrganization>>(`/platform/organizations/${id}/status`, {
    status,
  });
  return unwrap(data);
}
