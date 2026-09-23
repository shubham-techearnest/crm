import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface TaxRate {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  ratePercent: number;
  jurisdiction: string | null;
  taxType: string;
  active: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaxRateBody {
  code: string;
  name: string;
  ratePercent: number;
  jurisdiction?: string;
  taxType?: string;
  description?: string;
}

export async function listTaxRates(params?: {
  search?: string;
  taxType?: string;
  activeOnly?: boolean;
}): Promise<TaxRate[]> {
  const { data } = await api.get<ApiResponse<TaxRate[]>>("/tax-rates", {
    params: {
      size: 100,
      search: params?.search || undefined,
      taxType: params?.taxType || undefined,
      activeOnly: params?.activeOnly || undefined,
    },
  });
  return unwrap(data, "Unable to load tax rates");
}

export async function createTaxRate(body: CreateTaxRateBody): Promise<TaxRate> {
  const { data } = await api.post<ApiResponse<TaxRate>>("/tax-rates", body);
  return unwrap(data, "Unable to create tax rate");
}
