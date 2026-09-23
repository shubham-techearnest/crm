import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface Resource {
  id: string;
  organizationId: string;
  regionId: string;
  userId: string | null;
  employeeCode: string | null;
  designation: string | null;
  departmentId: string | null;
  managerId: string | null;
  resourceType: string;
  joiningDate: string | null;
  costRate: number | null;
  billingRate: number | null;
  capacityHoursPerWeek: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
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
}

export interface ResourceSkillItem {
  skillId: string;
  proficiency: string;
  yearsOfExperience?: number | null;
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
