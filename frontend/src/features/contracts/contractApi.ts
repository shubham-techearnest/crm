import type { ApiResponse } from "@/types/api";
import api from "@/api/client";
import type { ContractFilterCondition } from "./contractFilterCatalog";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface Contract {
  id: string;
  organizationId: string;
  regionId: string;
  accountId: string;
  projectId: string | null;
  name: string;
  contractNumber: string | null;
  status: string;
  valueAmount: number | null;
  currencyCode: string;
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
  renewalNoticeDays: number;
  terms: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listContracts(params?: {
  search?: string;
  status?: string;
  accountId?: string;
  autoRenew?: boolean;
}): Promise<Contract[]> {
  const { data } = await api.get<ApiResponse<Contract[]>>("/contracts", {
    params: {
      size: 100,
      search: params?.search || undefined,
      status: params?.status || undefined,
      accountId: params?.accountId || undefined,
      autoRenew: params?.autoRenew,
    },
  });
  return unwrap(data);
}

export async function queryContracts(body: {
  filter?: { op: string; conditions: ContractFilterCondition[] };
  search?: string;
  status?: string;
  accountId?: string;
  autoRenew?: boolean;
}): Promise<Contract[]> {
  const { data } = await api.post<ApiResponse<Contract[]>>("/contracts/query", {
    ...body,
    page: 0,
    size: 100,
  });
  return unwrap(data);
}

export async function createContract(body: {
  regionId: string;
  accountId: string;
  projectId?: string;
  name: string;
  contractNumber?: string;
  valueAmount?: number;
  currencyCode?: string;
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
  renewalNoticeDays?: number;
  terms?: string;
  status?: string;
}): Promise<Contract> {
  const { data } = await api.post<ApiResponse<Contract>>("/contracts", body);
  return unwrap(data);
}
