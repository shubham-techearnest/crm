import axios from "axios";
import type { ApiResponse } from "@/types/api";

export const PORTAL_ACCESS_TOKEN_KEY = "te.portalAccessToken";

const portalApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
});

portalApi.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(PORTAL_ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface PortalLoginBody {
  email: string;
  password: string;
}

export interface PortalTokenResponse {
  accessToken: string;
  expiresInSeconds: number;
  audience: string;
}

export interface PortalProjectSummary {
  id: string;
  name: string;
  status: string;
  endDate: string | null;
}

export interface PortalInvoiceSummary {
  id: string;
  invoiceNumber: string | null;
  status: string;
  total: number;
  balanceDue: number;
  dueDate: string | null;
}

export interface PortalDocumentSummary {
  id: string;
  fileName: string;
  entityType: string;
  entityId: string;
}

export async function portalLogin(body: PortalLoginBody): Promise<PortalTokenResponse> {
  const { data } = await portalApi.post<ApiResponse<PortalTokenResponse>>("/portal/auth/login", body);
  return unwrap(data);
}

export async function listPortalProjects(): Promise<PortalProjectSummary[]> {
  const { data } = await portalApi.get<ApiResponse<PortalProjectSummary[]>>("/portal/projects");
  return unwrap(data);
}

export async function listPortalInvoices(): Promise<PortalInvoiceSummary[]> {
  const { data } = await portalApi.get<ApiResponse<PortalInvoiceSummary[]>>("/portal/invoices");
  return unwrap(data);
}

export async function listPortalDocuments(): Promise<PortalDocumentSummary[]> {
  const { data } = await portalApi.get<ApiResponse<PortalDocumentSummary[]>>("/portal/documents");
  return unwrap(data);
}
