import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

export interface PlatformDashboard {
  orgCount: number;
  activeOrgCount: number;
  suspendedOrgCount: number;
  activeUserCount: number;
}

export async function fetchPlatformDashboard(): Promise<PlatformDashboard> {
  const { data } = await api.get<ApiResponse<PlatformDashboard>>("/platform/dashboard");
  if (!data.data) {
    throw new Error(data.message ?? "Unable to load platform dashboard");
  }
  return data.data;
}
