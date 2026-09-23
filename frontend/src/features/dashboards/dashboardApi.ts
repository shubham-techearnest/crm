import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface NamedValue {
  name: string;
  value: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface DashboardResponse {
  cards: NamedValue[];
  seriesPrimary: NamedCount[];
  seriesSecondary: NamedCount[];
  title: string;
}

export type DashboardKind = "organization" | "region" | "sales" | "project" | "employee";

export async function getDashboard(
  kind: DashboardKind,
  params?: { organizationId?: string; regionId?: string },
): Promise<DashboardResponse> {
  const { data } = await api.get<ApiResponse<DashboardResponse>>(`/dashboards/${kind}`, { params });
  return unwrap(data, "Unable to load dashboard");
}

export interface SearchHit {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchHit[];
}

export async function globalSearch(q: string, types?: string): Promise<SearchResponse> {
  const { data } = await api.get<ApiResponse<SearchResponse>>("/search", {
    params: { q, types },
  });
  return unwrap(data, "Search failed");
}
