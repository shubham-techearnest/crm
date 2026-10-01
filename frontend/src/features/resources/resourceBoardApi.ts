import type { ApiResponse } from "@/types/api";
import api from "@/api/client";
import type { Unavailability } from "./resourceApi";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

/** Money fields are absent when the viewer may not see rates (see `financialsVisible`). */
export interface BoardSkill {
  skillId: string;
  name: string | null;
  proficiency: string | null;
  yearsOfExperience: number | null;
  primary: boolean;
}

export interface BoardAllocation {
  allocationId: string;
  projectId: string;
  projectName: string | null;
  projectCode: string | null;
  projectStatus: string | null;
  projectEndDate: string | null;
  role: string | null;
  allocationPct: number;
  hoursPerWeek: number;
  startDate: string;
  endDate: string;
  status: string;
  /** PAST, CURRENT, FUTURE or CANCELLED. */
  phase: string;
  billable: boolean;
  costRate?: number | null;
  billingRate?: number | null;
}

export interface BoardResource {
  id: string;
  name: string | null;
  code: string | null;
  resourceType: string;
  category: "INTERNAL" | "EXTERNAL";
  designation: string | null;
  departmentId: string | null;
  departmentName: string | null;
  managerName: string | null;
  regionId: string;
  location: string | null;
  status: string;
  storedStatus: string;
  band: string;
  currentAllocationPct: number;
  futureAllocationPct: number;
  available: boolean;
  availableFrom: string | null;
  availableCapacityPct: number | null;
  endingSoon: boolean;
  currentAllocationEndsOn: string | null;
  nextAllocationStartsOn: string | null;
  engagementStartDate: string | null;
  engagementEndDate: string | null;
  engagementEndingSoon: boolean;
  onLeave: boolean;
  experienceYears: number | null;
  billable: boolean;
  activeProjectCount: number;
  capacityHours: number;
  allocatedHours: number;
  availableHours: number;
  utilizationPct: number;
  actualHours: number;
  billableHours: number;
  pendingHours: number;
  cost?: number | null;
  revenue?: number | null;
  margin?: number | null;
  marginPct?: number | null;
  costRate?: number | null;
  billingRate?: number | null;
  rateUnit?: string | null;
  skills: BoardSkill[];
  allocations: BoardAllocation[];
  weeklyLoad: number[];
}

export interface BoardProject {
  projectId: string;
  name: string;
  projectCode: string | null;
  status: string;
  billingType: string | null;
  endDate: string | null;
  managerName: string | null;
  teamSize: number;
  fte: number;
  allocatedHours: number;
  actualHours: number;
  billableHours: number;
  cost?: number | null;
  revenue?: number | null;
  profit?: number | null;
  marginPct?: number | null;
  membersEndingSoon: number;
  membersOverallocated: number;
  staffingSignal: string;
}

export interface SkillSupply {
  skillId: string;
  name: string | null;
  category: string | null;
  resources: number;
  available: number;
  primary: number;
}

export interface GroupMetrics {
  key: string;
  label: string;
  resources: number;
  capacityHours: number;
  allocatedHours: number;
  availableHours: number;
  utilizationPct: number;
  actualHours: number;
  billableHours: number;
  nonBillableHours: number;
  billableUtilizationPct: number;
  cost?: number | null;
  revenue?: number | null;
  margin?: number | null;
  marginPct?: number | null;
}

export interface BoardSummary {
  totalResources: number;
  employees: number;
  externals: number;
  available: number;
  bench: number;
  partiallyAllocated: number;
  fullyAllocated: number;
  overallocated: number;
  endingSoon: number;
  onLeave: number;
  inactive: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  totals: GroupMetrics;
}

export interface BoardSettings {
  endingSoonDays: number;
  benchMaxAllocationPct: number;
  fullAllocationPct: number;
  overallocationPct: number;
  forecastWeeks: number;
  updatedAt?: string | null;
}

export interface ResourceBoard {
  asOf: string;
  periodStart: string;
  periodEnd: string;
  financialsVisible: boolean;
  settings: BoardSettings;
  weeks: string[];
  summary: BoardSummary;
  resources: BoardResource[];
  projects: BoardProject[];
  skills: SkillSupply[];
  byDepartment: GroupMetrics[];
  byType: GroupMetrics[];
}

export interface BoardFilters {
  periodStart?: string;
  periodEnd?: string;
  search?: string;
  resourceType?: string[];
  category?: string;
  departmentId?: string;
  regionId?: string;
  projectId?: string;
  skillId?: string[];
  minExperienceYears?: number | null;
  availableWithinDays?: number | null;
  maxAllocationPct?: number | null;
  status?: string[];
  location?: string;
  billable?: boolean | null;
  includeInactive?: boolean;
}

export interface WorkloadTask {
  id: string;
  projectId: string;
  projectName: string | null;
  name: string;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
}

export interface WorkloadTimesheet {
  id: string;
  weekStartDate: string;
  status: string;
  hours: number;
  billableHours: number;
}

export interface WorkloadProjectCost {
  projectId: string;
  projectName: string | null;
  hours: number;
  billableHours: number;
  cost?: number | null;
  revenue?: number | null;
  margin?: number | null;
  marginPct?: number | null;
}

export interface ResourceWorkload {
  financialsVisible: boolean;
  resource: BoardResource;
  allocations: BoardAllocation[];
  tasks: WorkloadTask[];
  timesheets: WorkloadTimesheet[];
  costs: WorkloadProjectCost[];
  leave: Unavailability[];
  weeks: string[];
}

function params(filters: BoardFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

export async function getResourceBoard(filters: BoardFilters): Promise<ResourceBoard> {
  const { data } = await api.get<ApiResponse<ResourceBoard>>("/resource-board", {
    params: params(filters),
    paramsSerializer: { indexes: null },
  });
  return unwrap(data);
}

export async function getResourceWorkload(
  resourceId: string,
  periodStart?: string,
  periodEnd?: string,
): Promise<ResourceWorkload> {
  const { data } = await api.get<ApiResponse<ResourceWorkload>>(`/resource-board/resources/${resourceId}`, {
    params: { periodStart: periodStart || undefined, periodEnd: periodEnd || undefined },
  });
  return unwrap(data);
}

export async function getBoardSettings(): Promise<BoardSettings> {
  const { data } = await api.get<ApiResponse<BoardSettings>>("/resource-board/settings");
  return unwrap(data);
}

export async function updateBoardSettings(body: Partial<BoardSettings>): Promise<BoardSettings> {
  const { data } = await api.put<ApiResponse<BoardSettings>>("/resource-board/settings", body);
  return unwrap(data);
}
