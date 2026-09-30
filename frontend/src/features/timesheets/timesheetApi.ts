import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface TimeEntry {
  id: string;
  timesheetId: string;
  projectId: string;
  taskId: string | null;
  workDate: string;
  hours: number;
  description: string | null;
  billable: boolean;
  billingRate: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Timesheet {
  id: string;
  organizationId: string;
  resourceId: string;
  regionId: string;
  weekStartDate: string;
  status: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  totalHours: number | null;
  warning: string | null;
  entries: TimeEntry[];
  createdAt: string;
  updatedAt: string;
  /** SELF, PROXY, LINK or IMPORT. */
  entrySource: string;
  enteredBy: string | null;
  resourceName: string | null;
  notes: string | null;
}

export interface EntryTaskOption {
  taskId: string;
  name: string;
  status: string | null;
}

export interface EntryProjectOption {
  projectId: string;
  name: string;
  projectCode: string | null;
  status?: string | null;
  /** Completed or cancelled: shown for reference, but no new time can be logged. */
  closed?: boolean;
  tasks: EntryTaskOption[];
}

export function closedProjectLabel(status: string | null | undefined): string {
  return status === "CANCELLED" ? "Cancelled" : "Completed";
}

export type TimesheetStartWith = "BLANK" | "COPY_PREVIOUS" | "QUICK_FILL";

export interface QuickFillBody {
  projectId: string;
  taskId?: string | null;
  hoursPerDay: number;
  /** ISO days of the week: 1 = Monday … 7 = Sunday. */
  days: number[];
  billable: boolean;
  description?: string | null;
}

export interface CreateTimesheetBody {
  organizationId?: string;
  resourceId?: string;
  weekStartDate: string;
  notes?: string | null;
  startWith?: TimesheetStartWith;
  quickFill?: QuickFillBody | null;
  submitAfterCreate?: boolean;
}

export interface CreateTimeEntryBody {
  projectId: string;
  taskId?: string | null;
  workDate: string;
  hours: number;
  description?: string;
  billable?: boolean;
  billingRate?: number | null;
}

export interface GridEntryBody {
  projectId: string;
  taskId?: string | null;
  workDate: string;
  hours: number;
  description?: string | null;
  billable: boolean;
}

export interface BulkActionResult {
  id: string;
  success: boolean;
  message: string | null;
}

export interface TimeBucket {
  id: string | null;
  label: string;
  approvedHours: number;
  pendingHours: number;
  billableHours: number;
}

export interface ProjectTimeSummary {
  projectId: string;
  estimatedHours: number | null;
  approvedHours: number;
  pendingHours: number;
  draftHours: number;
  billableHours: number;
  nonBillableHours: number;
  billableAmount: number | null;
  unbilledHours: number;
  byResource: TimeBucket[];
  byTask: TimeBucket[];
  byWeek: TimeBucket[];
}

export interface TimesheetWeek {
  timesheetId: string;
  weekStartDate: string;
  status: string;
  totalHours: number;
}

export interface ResourceTimeSummary {
  resourceId: string;
  periodStart: string;
  periodEnd: string;
  capacityHours: number;
  approvedHours: number;
  pendingHours: number;
  billableHours: number;
  actualUtilizationPercent: number | null;
  billableUtilizationPercent: number | null;
  byProject: TimeBucket[];
  recentWeeks: TimesheetWeek[];
}

export async function listTimesheets(params?: {
  status?: string;
  resourceId?: string;
  weekStart?: string;
  billableOnly?: boolean;
  awaitingMyApproval?: boolean;
}): Promise<Timesheet[]> {
  const { data } = await api.get<ApiResponse<Timesheet[]>>("/timesheets", {
    params: {
      size: 100,
      status: params?.status || undefined,
      resourceId: params?.resourceId || undefined,
      weekStart: params?.weekStart || undefined,
      billableOnly: params?.billableOnly || undefined,
      awaitingMyApproval: params?.awaitingMyApproval || undefined,
    },
  });
  return unwrap(data, "Unable to load timesheets");
}

export async function saveTimesheetEntries(id: string, entries: GridEntryBody[]): Promise<Timesheet> {
  const { data } = await api.put<ApiResponse<Timesheet>>(`/timesheets/${id}/entries`, { entries });
  return unwrap(data, "Unable to save timesheet");
}

export async function copyPreviousWeek(id: string): Promise<Timesheet> {
  const { data } = await api.post<ApiResponse<Timesheet>>(`/timesheets/${id}/copy-previous-week`);
  return unwrap(data, "Unable to copy last week");
}

export async function bulkApproveTimesheets(ids: string[]): Promise<BulkActionResult[]> {
  const { data } = await api.post<ApiResponse<BulkActionResult[]>>("/timesheets/bulk-approve", { ids });
  return unwrap(data, "Unable to approve timesheets");
}

export async function bulkRejectTimesheets(ids: string[], reason: string): Promise<BulkActionResult[]> {
  const { data } = await api.post<ApiResponse<BulkActionResult[]>>("/timesheets/bulk-reject", { ids, reason });
  return unwrap(data, "Unable to reject timesheets");
}

export async function getProjectTimeSummary(projectId: string): Promise<ProjectTimeSummary> {
  const { data } = await api.get<ApiResponse<ProjectTimeSummary>>(`/projects/${projectId}/time-summary`);
  return unwrap(data, "Unable to load time summary");
}

export async function getResourceTimeSummary(
  resourceId: string,
  period?: { from?: string; to?: string },
): Promise<ResourceTimeSummary> {
  const { data } = await api.get<ApiResponse<ResourceTimeSummary>>(`/resources/${resourceId}/time-summary`, {
    params: { from: period?.from || undefined, to: period?.to || undefined },
  });
  return unwrap(data, "Unable to load time summary");
}

export async function getTimesheet(id: string): Promise<Timesheet> {
  const { data } = await api.get<ApiResponse<Timesheet>>(`/timesheets/${id}`);
  return unwrap(data, "Unable to load timesheet");
}

export async function listEntryProjects(timesheetId: string): Promise<EntryProjectOption[]> {
  const { data } = await api.get<ApiResponse<EntryProjectOption[]>>(`/timesheets/${timesheetId}/projects`);
  return unwrap(data, "Unable to load projects");
}

export async function listEntryProjectsForResource(resourceId?: string): Promise<EntryProjectOption[]> {
  const { data } = await api.get<ApiResponse<EntryProjectOption[]>>("/timesheets/entry-projects", {
    params: { resourceId: resourceId || undefined },
  });
  return unwrap(data, "Unable to load projects");
}

export async function updateTimesheetNotes(id: string, notes: string): Promise<Timesheet> {
  const { data } = await api.put<ApiResponse<Timesheet>>(`/timesheets/${id}`, { notes });
  return unwrap(data, "Unable to update timesheet");
}

export async function createTimesheet(body: CreateTimesheetBody): Promise<Timesheet> {
  const { data } = await api.post<ApiResponse<Timesheet>>("/timesheets", body);
  return unwrap(data, "Unable to create timesheet");
}

export async function addTimeEntry(timesheetId: string, body: CreateTimeEntryBody): Promise<TimeEntry> {
  const { data } = await api.post<ApiResponse<TimeEntry>>(`/timesheets/${timesheetId}/entries`, body);
  return unwrap(data, "Unable to add time entry");
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await api.delete(`/time-entries/${id}`);
}

export async function submitTimesheet(id: string): Promise<Timesheet> {
  const { data } = await api.post<ApiResponse<Timesheet>>(`/timesheets/${id}/submit`);
  return unwrap(data, "Unable to submit timesheet");
}

export async function approveTimesheet(id: string): Promise<Timesheet> {
  const { data } = await api.post<ApiResponse<Timesheet>>(`/timesheets/${id}/approve`);
  return unwrap(data, "Unable to approve timesheet");
}

export async function rejectTimesheet(id: string, reason: string): Promise<Timesheet> {
  const { data } = await api.post<ApiResponse<Timesheet>>(`/timesheets/${id}/reject`, { reason });
  return unwrap(data, "Unable to reject timesheet");
}

export async function exportTimesheetsCsv(): Promise<Blob> {
  const { data } = await api.get<Blob>("/timesheets/export", { responseType: "blob" });
  return data;
}

/** ISO date (yyyy-mm-dd) for the Monday of the given local date. */
export function mondayOf(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
