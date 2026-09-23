import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

export interface PlatformProspect {
  id: string;
  name: string;
  legalName: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: string;
  estimatedArr: number | null;
  ownerUserId: string | null;
  notes: string | null;
  linkedOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertProspectBody {
  name: string;
  legalName?: string;
  website?: string;
  email?: string;
  phone?: string;
  source?: string;
  stage?: string;
  estimatedArr?: number;
  ownerUserId?: string;
  notes?: string;
}

export interface ProspectFilterNode {
  op?: string;
  conditions?: ProspectFilterNode[];
  field?: string;
  operator?: string;
  value?: unknown;
  valueTo?: unknown;
}

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export async function listPlatformProspects(params?: {
  search?: string;
  stage?: string;
  source?: string;
}): Promise<{ items: PlatformProspect[]; total: number }> {
  const { data } = await api.get<ApiResponse<PlatformProspect[]>>("/platform/prospects", {
    params: { size: 100, ...params },
  });
  return { items: unwrap(data), total: data.pagination?.totalElements ?? unwrap(data).length };
}

export async function queryPlatformProspects(body: {
  search?: string;
  stage?: string;
  source?: string;
  filter?: ProspectFilterNode;
  page?: number;
  size?: number;
}): Promise<{ items: PlatformProspect[]; total: number }> {
  const { data } = await api.post<ApiResponse<PlatformProspect[]>>("/platform/prospects/query", {
    page: 0,
    size: 100,
    ...body,
  });
  return { items: unwrap(data), total: data.pagination?.totalElements ?? unwrap(data).length };
}

export async function createPlatformProspect(body: UpsertProspectBody): Promise<PlatformProspect> {
  const { data } = await api.post<ApiResponse<PlatformProspect>>("/platform/prospects", body);
  return unwrap(data);
}

export async function updatePlatformProspect(id: string, body: UpsertProspectBody): Promise<PlatformProspect> {
  const { data } = await api.put<ApiResponse<PlatformProspect>>(`/platform/prospects/${id}`, body);
  return unwrap(data);
}

export async function deletePlatformProspect(id: string): Promise<void> {
  await api.delete(`/platform/prospects/${id}`);
}

export async function linkProspectOrganization(id: string, organizationId: string): Promise<PlatformProspect> {
  const { data } = await api.post<ApiResponse<PlatformProspect>>(`/platform/prospects/${id}/link-organization`, {
    organizationId,
  });
  return unwrap(data);
}
