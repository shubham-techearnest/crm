import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface WorkflowDefinitionSummary {
  id: string;
  code: string;
  name: string;
  eventType: string;
  active: boolean;
  version: number;
}

export async function listWorkflowDefinitions(): Promise<WorkflowDefinitionSummary[]> {
  const { data } = await api.get<ApiResponse<WorkflowDefinitionSummary[]>>("/admin/workflows");
  return unwrap(data);
}

export async function setWorkflowActive(id: string, active: boolean): Promise<WorkflowDefinitionSummary> {
  const { data } = await api.put<ApiResponse<WorkflowDefinitionSummary>>(`/admin/workflows/${id}/active`, { active });
  return unwrap(data);
}
