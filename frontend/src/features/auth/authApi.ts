import type { ApiResponse } from "@/types/api";
import api, { ACCESS_TOKEN_KEY } from "@/api/client";

export interface MeResponse {
  userId: string;
  organizationId: string | null;
  email: string;
  displayName: string;
  dataScope: string;
  regionIds: string[];
  departmentId: string | null;
  teamId: string | null;
  resourceId: string | null;
  permissions: string[];
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

export function getAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<ApiResponse<TokenResponse>>("/auth/login", { email, password });
  if (!data.data) {
    throw new Error(data.message ?? "Sign in failed");
  }
  setAccessToken(data.data.accessToken);
  return data.data;
}

export async function refreshSession(): Promise<TokenResponse> {
  const { data } = await api.post<ApiResponse<TokenResponse>>("/auth/refresh");
  if (!data.data) {
    throw new Error(data.message ?? "Session expired");
  }
  setAccessToken(data.data.accessToken);
  return data.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    clearAccessToken();
  }
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await api.get<ApiResponse<MeResponse>>("/auth/me");
  if (!data.data) {
    throw new Error(data.message ?? "Unable to load profile");
  }
  return data.data;
}
