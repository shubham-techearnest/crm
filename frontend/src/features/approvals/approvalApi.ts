import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  workflowId: string;
  targetType: string;
  targetId: string;
  status: string;
  currentStepId: string | null;
  submittedBy: string;
  submittedAt: string;
  regionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listApprovalRequests(params?: {
  targetType?: string;
  status?: string;
}): Promise<ApprovalRequest[]> {
  const { data } = await api.get<ApiResponse<ApprovalRequest[]>>("/approval-requests", {
    params: {
      targetType: params?.targetType || undefined,
      status: params?.status || undefined,
    },
  });
  return unwrap(data, "Unable to load approvals");
}

export async function actOnApproval(
  id: string,
  body: { action: "APPROVE" | "REJECT"; comment?: string },
): Promise<ApprovalRequest> {
  const { data } = await api.post<ApiResponse<ApprovalRequest>>(`/approval-requests/${id}/actions`, body);
  return unwrap(data, "Unable to action approval");
}
