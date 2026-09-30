import type { ApiResponse } from "@/types/api";
import publicApi from "@/api/publicClient";
import type { EntryProjectOption } from "@/features/timesheets/timesheetApi";

function unwrap<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

// —— Invitation (public) ——

export interface InvitePreview {
  email: string;
  name: string;
  organizationName: string | null;
  expiresAt: string;
}

export async function getInvite(token: string): Promise<InvitePreview> {
  const { data } = await publicApi.get<ApiResponse<InvitePreview>>(`/public/invites/${encodeURIComponent(token)}`);
  return unwrap(data, "This invitation is invalid or has expired");
}

export async function acceptInvite(token: string, password: string): Promise<{ email: string }> {
  const { data } = await publicApi.post<ApiResponse<{ email: string }>>(
    `/public/invites/${encodeURIComponent(token)}/accept`,
    { password },
  );
  return unwrap(data, "Could not set your password");
}

// —— Emailed timesheet link (public) ——

export interface LinkEntry {
  projectId: string;
  taskId: string | null;
  workDate: string;
  hours: number;
  description: string | null;
  billable: boolean;
}

export interface TimesheetLinkView {
  resourceName: string;
  organizationName: string | null;
  weekStartDate: string;
  weekEndDate: string;
  status: string | null;
  rejectionReason: string | null;
  editable: boolean;
  expiresAt: string;
  capacityHoursPerWeek: number | null;
  projects: EntryProjectOption[];
  entries: LinkEntry[];
}

export interface LinkEntryBody {
  projectId: string;
  taskId?: string | null;
  workDate: string;
  hours: number;
  description?: string | null;
  billable?: boolean;
}

export async function getTimesheetLink(token: string): Promise<TimesheetLinkView> {
  const { data } = await publicApi.get<ApiResponse<TimesheetLinkView>>(
    `/public/timesheet-links/${encodeURIComponent(token)}`,
  );
  return unwrap(data, "This timesheet link is invalid or has expired");
}

export async function submitTimesheetLink(token: string, entries: LinkEntryBody[]): Promise<TimesheetLinkView> {
  const { data } = await publicApi.post<ApiResponse<TimesheetLinkView>>(
    `/public/timesheet-links/${encodeURIComponent(token)}/submit`,
    { entries },
  );
  return unwrap(data, "Could not submit the timesheet");
}
