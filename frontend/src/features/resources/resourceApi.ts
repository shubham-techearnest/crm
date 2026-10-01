import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export const RESOURCE_TYPES = ["EMPLOYEE", "CONTRACTOR", "FREELANCER", "CONSULTANT", "OTHER_EXTERNAL"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** Codes are auto-numbered per prefix (EMP-001, CON-001, FRL-001) when a resource is created. */
export const RESOURCE_TYPE_META: Record<ResourceType, { label: string; prefix: string; hint: string }> = {
  EMPLOYEE: { label: "Internal employee", prefix: "EMP", hint: "Own staff, linked to a user account" },
  CONTRACTOR: { label: "Contractor", prefix: "CON", hint: "External, contract based" },
  FREELANCER: { label: "Freelancer", prefix: "FRL", hint: "External, engaged per assignment" },
  CONSULTANT: { label: "Consultant", prefix: "CON", hint: "External, contract based advisory" },
  OTHER_EXTERNAL: { label: "Other external", prefix: "EXT", hint: "Any other outside resource" },
};

export const RATE_UNITS = ["HOURLY", "DAILY", "MONTHLY"] as const;

/** Lifecycle states that take a resource out of the workforce. */
export const ENDED_STATUSES = ["INACTIVE", "CONTRACT_EXPIRED", "TERMINATED"] as const;

export const LEAVE_KINDS = ["LEAVE", "HOLIDAY", "SICK", "TRAINING", "OTHER"] as const;

export function resourceTypeLabel(type: string | null | undefined): string {
  return (type && RESOURCE_TYPE_META[type as ResourceType]?.label) || type || "—";
}

export function isExternalType(type: string | null | undefined): boolean {
  return type !== "EMPLOYEE";
}

export interface Resource {
  id: string;
  organizationId: string;
  regionId: string;
  userId: string | null;
  employeeName: string | null;
  employeeCode: string | null;
  designation: string | null;
  departmentId: string | null;
  departmentName: string | null;
  managerId: string | null;
  managerName: string | null;
  resourceType: string;
  joiningDate: string | null;
  costRate: number | null;
  billingRate: number | null;
  capacityHoursPerWeek: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  engagementEndDate: string | null;
  /** NONE (no login), INVITED, ACTIVE, EXPIRED or DEACTIVATED. */
  loginStatus: string;
  accessExpiresAt: string | null;
  typeCategory?: "INTERNAL" | "EXTERNAL" | null;
  engagementStartDate?: string | null;
  contractReference?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  workingHoursPerDay?: number | null;
  workingDaysPerWeek?: number | null;
  experienceYears?: number | null;
  location?: string | null;
  availableFrom?: string | null;
  billable?: boolean;
  rateUnit?: string | null;
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
}

/** Profile, capacity and engagement fields; omitted values stay unchanged. */
export interface ResourceProfileBody {
  engagementStartDate?: string | null;
  contractReference?: string | null;
  vendorId?: string | null;
  workingHoursPerDay?: number | null;
  workingDaysPerWeek?: number | null;
  experienceYears?: number | null;
  location?: string | null;
  availableFrom?: string | null;
  billable?: boolean;
  rateUnit?: string | null;
  clearVendor?: boolean;
  clearAvailableFrom?: boolean;
  clearEngagementStartDate?: boolean;
}

export interface CreateResourceBody {
  organizationId?: string;
  regionId: string;
  userId?: string | null;
  employeeCode?: string;
  designation?: string;
  departmentId?: string | null;
  managerId?: string | null;
  resourceType: string;
  joiningDate?: string | null;
  costRate?: number | null;
  billingRate?: number | null;
  capacityHoursPerWeek?: number | null;
  status?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  engagementEndDate?: string | null;
  profile?: ResourceProfileBody;
}

export interface UpdateResourceBody {
  regionId?: string;
  userId?: string | null;
  employeeCode?: string;
  designation?: string;
  departmentId?: string | null;
  managerId?: string | null;
  resourceType?: string;
  joiningDate?: string | null;
  costRate?: number | null;
  billingRate?: number | null;
  capacityHoursPerWeek?: number | null;
  status?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  engagementEndDate?: string | null;
  clearEngagementEndDate?: boolean;
  profile?: ResourceProfileBody;
}

export interface ResourceTypeOption {
  code: string;
  name: string;
  category: "INTERNAL" | "EXTERNAL";
  codePrefix: string;
  requiresUser: boolean;
  active: boolean;
}

export interface DeactivateResourceBody {
  status?: string;
  reason?: string;
  effectiveDate?: string;
  endOpenAllocations?: boolean;
  revokePortalAccess?: boolean;
}

export interface ReactivateResourceBody {
  engagementStartDate?: string | null;
  engagementEndDate?: string | null;
  availableFrom?: string | null;
}

export interface ResourceLifecycleResult {
  resource: Resource;
  allocationsEnded: number;
  allocationsCancelled: number;
  portalAccessRevoked: boolean;
}

export interface Unavailability {
  id: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  kind: string;
  hoursPerDay: number | null;
  reason: string | null;
  createdAt: string;
}

export interface UnavailabilityBody {
  startDate: string;
  endDate: string;
  kind?: string;
  hoursPerDay?: number | null;
  reason?: string;
}

export interface PortalAccess {
  resourceId: string;
  userId: string | null;
  email: string | null;
  loginStatus: string;
  accessExpiresAt: string | null;
  inviteUrl: string | null;
  inviteExpiresAt: string | null;
  emailed: boolean;
  /** False when the linked login is a regular internal user. */
  portalManaged: boolean;
}

export interface TimesheetLinkIssued {
  url: string;
  expiresAt: string;
  weekStartDate: string;
  emailed: boolean;
  email: string | null;
}

export interface Skill {
  id: string;
  organizationId: string;
  name: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkillBody {
  organizationId?: string;
  name: string;
  category?: string;
}

export interface UpdateSkillBody {
  name?: string;
  category?: string;
}

export interface ResourceSkill {
  skillId: string;
  proficiency: string;
  yearsOfExperience: number | null;
  primary?: boolean;
  certification?: string | null;
}

export interface ResourceSkillItem {
  skillId: string;
  proficiency: string;
  yearsOfExperience?: number | null;
  primary?: boolean;
  certification?: string | null;
}

export interface ReplaceSkillsBody {
  skills: ResourceSkillItem[];
}

export interface Utilization {
  resourceId: string;
  periodStart: string;
  periodEnd: string;
  capacityHours: number | null;
  allocatedHours: number | null;
  availableHours: number | null;
  utilizationPercent: number | null;
  overAllocated: boolean;
  warning: string | null;
}

export interface Allocation {
  id: string;
  organizationId: string;
  projectId: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  allocatedHours: number | null;
  allocationPercentage: number | null;
  role: string | null;
  billingRate: number | null;
  costRate: number | null;
  status: string;
  warning: string | null;
  createdAt: string;
  updatedAt: string;
  billable?: boolean;
  source?: string | null;
  notes?: string | null;
  milestoneId?: string | null;
  endedAt?: string | null;
  /** Non-blocking notes, e.g. outside the engagement or project window. */
  warnings?: string[];
}

export interface CreateAllocationBody {
  organizationId?: string;
  projectId: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  allocatedHours?: number | null;
  allocationPercentage?: number | null;
  role?: string;
  billingRate?: number | null;
  costRate?: number | null;
  status?: string;
  dryRun?: boolean;
  billable?: boolean;
  notes?: string;
  milestoneId?: string | null;
}

export interface UpdateAllocationBody {
  startDate?: string;
  endDate?: string;
  allocatedHours?: number | null;
  allocationPercentage?: number | null;
  role?: string;
  billingRate?: number | null;
  costRate?: number | null;
  status?: string;
  dryRun?: boolean;
  billable?: boolean;
  notes?: string;
  milestoneId?: string | null;
  clearMilestone?: boolean;
}

// —— Resources ——

export async function listResources(params?: {
  search?: string;
  status?: string;
  regionId?: string;
  skillId?: string;
}): Promise<Resource[]> {
  const { data } = await api.get<ApiResponse<Resource[]>>("/resources", {
    params: {
      size: 100,
      search: params?.search || undefined,
      status: params?.status || undefined,
      regionId: params?.regionId || undefined,
      skillId: params?.skillId || undefined,
    },
  });
  return unwrap(data);
}

export async function getResource(id: string): Promise<Resource> {
  const { data } = await api.get<ApiResponse<Resource>>(`/resources/${id}`);
  return unwrap(data);
}

export async function createResource(body: CreateResourceBody): Promise<Resource> {
  const { data } = await api.post<ApiResponse<Resource>>("/resources", body);
  return unwrap(data);
}

export interface OnboardResourceBody {
  resource: CreateResourceBody;
  projectId?: string | null;
  allocationStartDate?: string | null;
  allocationEndDate?: string | null;
  allocationPercentage?: number | null;
  allocationRole?: string | null;
  grantPortalAccess?: boolean;
}

export interface OnboardResourceResult {
  resource: Resource;
  allocation: Allocation | null;
  portalAccess: PortalAccess | null;
  warnings: string[];
}

/** Creates the resource, allocates it to a project and grants default access in one step. */
export async function onboardResource(body: OnboardResourceBody): Promise<OnboardResourceResult> {
  const { data } = await api.post<ApiResponse<OnboardResourceResult>>("/resources/onboard", body);
  return unwrap(data);
}

export async function updateResource(id: string, body: UpdateResourceBody): Promise<Resource> {
  const { data } = await api.put<ApiResponse<Resource>>(`/resources/${id}`, body);
  return unwrap(data);
}

export async function listResourceSkills(resourceId: string): Promise<ResourceSkill[]> {
  const { data } = await api.get<ApiResponse<ResourceSkill[]>>(`/resources/${resourceId}/skills`);
  return unwrap(data);
}

export async function putResourceSkills(
  resourceId: string,
  body: ReplaceSkillsBody,
): Promise<ResourceSkill[]> {
  const { data } = await api.put<ApiResponse<ResourceSkill[]>>(
    `/resources/${resourceId}/skills`,
    body,
  );
  return unwrap(data);
}

export async function getUtilization(
  resourceId: string,
  periodStart?: string,
  periodEnd?: string,
): Promise<Utilization> {
  const { data } = await api.get<ApiResponse<Utilization>>(
    `/resources/${resourceId}/utilization`,
    {
      params: {
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      },
    },
  );
  return unwrap(data);
}

// —— Portal access & timesheet links ——

export async function getPortalAccess(resourceId: string): Promise<PortalAccess> {
  const { data } = await api.get<ApiResponse<PortalAccess>>(`/resources/${resourceId}/portal-access`);
  return unwrap(data);
}

export async function inviteToPortal(
  resourceId: string,
  body: { email?: string; accessExpiresOn?: string | null },
): Promise<PortalAccess> {
  const { data } = await api.post<ApiResponse<PortalAccess>>(`/resources/${resourceId}/portal-access`, body);
  return unwrap(data);
}

export async function updatePortalAccess(resourceId: string, accessExpiresOn: string): Promise<PortalAccess> {
  const { data } = await api.put<ApiResponse<PortalAccess>>(`/resources/${resourceId}/portal-access`, {
    accessExpiresOn,
  });
  return unwrap(data);
}

export async function revokePortalAccess(resourceId: string): Promise<PortalAccess> {
  const { data } = await api.delete<ApiResponse<PortalAccess>>(`/resources/${resourceId}/portal-access`);
  return unwrap(data);
}

export async function issueTimesheetLink(
  resourceId: string,
  body: { weekStartDate: string; sendEmail?: boolean },
): Promise<TimesheetLinkIssued> {
  const { data } = await api.post<ApiResponse<TimesheetLinkIssued>>(
    `/resources/${resourceId}/timesheet-links`,
    body,
  );
  return unwrap(data);
}

// —— Skills ——

export async function listSkills(params?: {
  search?: string;
  name?: string;
  category?: string;
}): Promise<Skill[]> {
  const { data } = await api.get<ApiResponse<Skill[]>>("/skills", {
    params: {
      size: 100,
      search: params?.search || undefined,
      name: params?.name || undefined,
      category: params?.category || undefined,
    },
  });
  return unwrap(data);
}

export async function createSkill(body: CreateSkillBody): Promise<Skill> {
  const { data } = await api.post<ApiResponse<Skill>>("/skills", body);
  return unwrap(data);
}

export async function updateSkill(id: string, body: UpdateSkillBody): Promise<Skill> {
  const { data } = await api.put<ApiResponse<Skill>>(`/skills/${id}`, body);
  return unwrap(data);
}

export async function deleteSkill(id: string): Promise<void> {
  await api.delete(`/skills/${id}`);
}

// —— Allocations ——

export async function listAllocations(params?: {
  resourceId?: string;
  projectId?: string;
  status?: string;
  overlapOnly?: boolean;
}): Promise<Allocation[]> {
  const { data } = await api.get<ApiResponse<Allocation[]>>("/allocations", {
    params: {
      size: 100,
      resourceId: params?.resourceId || undefined,
      projectId: params?.projectId || undefined,
      status: params?.status || undefined,
      overlapOnly: params?.overlapOnly || undefined,
    },
  });
  return unwrap(data);
}

export async function getAllocation(id: string): Promise<Allocation> {
  const { data } = await api.get<ApiResponse<Allocation>>(`/allocations/${id}`);
  return unwrap(data);
}

export async function createAllocation(body: CreateAllocationBody): Promise<Allocation> {
  const { data } = await api.post<ApiResponse<Allocation>>("/allocations", body);
  return unwrap(data);
}

export async function updateAllocation(
  id: string,
  body: UpdateAllocationBody,
): Promise<Allocation> {
  const { data } = await api.put<ApiResponse<Allocation>>(`/allocations/${id}`, body);
  return unwrap(data);
}

export async function deleteAllocation(id: string): Promise<void> {
  const { data } = await api.delete<ApiResponse<null>>(`/allocations/${id}`);
  if (!data.success) throw new Error(data.message ?? "Could not delete allocation.");
}

/** Ends an allocation (today unless a date is given) and keeps it as history. */
export async function endAllocation(id: string, body?: { endDate?: string; reason?: string }): Promise<Allocation> {
  const { data } = await api.post<ApiResponse<Allocation>>(`/allocations/${id}/end`, body ?? {});
  return unwrap(data);
}

// —— Lifecycle, types and leave ——

export async function listResourceTypes(): Promise<ResourceTypeOption[]> {
  const { data } = await api.get<ApiResponse<ResourceTypeOption[]>>("/resources/types");
  return unwrap(data);
}

export async function deactivateResource(id: string, body: DeactivateResourceBody): Promise<ResourceLifecycleResult> {
  const { data } = await api.post<ApiResponse<ResourceLifecycleResult>>(`/resources/${id}/deactivate`, body);
  return unwrap(data);
}

export async function reactivateResource(id: string, body: ReactivateResourceBody): Promise<ResourceLifecycleResult> {
  const { data } = await api.post<ApiResponse<ResourceLifecycleResult>>(`/resources/${id}/reactivate`, body);
  return unwrap(data);
}

export async function listUnavailability(resourceId: string): Promise<Unavailability[]> {
  const { data } = await api.get<ApiResponse<Unavailability[]>>(`/resources/${resourceId}/unavailability`);
  return unwrap(data);
}

export async function addUnavailability(resourceId: string, body: UnavailabilityBody): Promise<Unavailability> {
  const { data } = await api.post<ApiResponse<Unavailability>>(`/resources/${resourceId}/unavailability`, body);
  return unwrap(data);
}

export async function removeUnavailability(leaveId: string): Promise<void> {
  await api.delete(`/resources/unavailability/${leaveId}`);
}
