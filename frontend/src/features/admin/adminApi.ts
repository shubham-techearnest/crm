import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  timezone: string;
  locale: string;
  currencyCode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  taxId: string | null;
  dateFormat: string;
  timeFormat: string;
  weekStartDay: string;
  fiscalYearStartMonth: number;
}

export interface Region {
  id: string;
  organizationId: string;
  parentId: string | null;
  name: string;
  code: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  description: string | null;
  managerId: string | null;
  timezone: string | null;
  currencyCode: string | null;
}

export interface Department {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  code: string | null;
  description: string | null;
  headId: string | null;
  email: string | null;
}

export interface Team {
  id: string;
  organizationId: string;
  departmentId: string;
  managerId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  description: string | null;
  email: string | null;
  status: string;
}

export interface Branch {
  id: string;
  organizationId: string;
  regionId: string;
  name: string;
  address: string | null;
  status: string;
}

export interface AdminUser {
  id: string;
  organizationId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  regionId: string | null;
  branchId: string | null;
  departmentId: string | null;
  teamId: string | null;
  managerId: string | null;
  roleIds: string[];
  roleCodes: string[];
  regionIds: string[];
  createdAt: string;
  jobTitle: string | null;
  employeeCode: string | null;
  mobile: string | null;
  dateOfJoining: string | null;
  timezone: string | null;
  locale: string | null;
  lastLoginAt: string | null;
  updatedAt: string | null;
}

export interface Role {
  id: string;
  organizationId: string | null;
  code: string;
  name: string;
  dataScope: string;
  system: boolean;
  permissionCodes: string[];
  createdAt: string;
  updatedAt: string;
  description: string | null;
}

export interface Permission {
  id: string;
  code: string;
  module: string;
  description: string;
}

export interface AuditLog {
  id: string;
  organizationId: string | null;
  regionId?: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  newValue?: string | null;
  createdAt: string;
}

export const USER_STATUSES = ["ACTIVE", "INVITED", "LOCKED", "DEACTIVATED"] as const;
export const ACTIVE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const DATA_SCOPES = ["ORGANIZATION", "REGION", "DEPARTMENT", "TEAM", "OWN"] as const;

export type OrganizationUpdateBody = Partial<Omit<Organization, "id" | "slug" | "createdAt" | "updatedAt">> & {
  name: string;
};

export interface UserCreateBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  regionId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  teamId?: string | null;
  managerId?: string | null;
  status?: string;
  roleIds?: string[];
  regionIds?: string[];
  jobTitle?: string | null;
  employeeCode?: string | null;
  mobile?: string | null;
  dateOfJoining?: string | null;
  timezone?: string | null;
  locale?: string | null;
}

export interface UserUpdateBody {
  firstName: string;
  lastName: string;
  phone: string | null;
  regionId: string | null;
  branchId: string | null;
  departmentId: string | null;
  teamId: string | null;
  managerId: string | null;
  status: string;
  jobTitle: string | null;
  employeeCode: string | null;
  mobile: string | null;
  dateOfJoining: string | null;
  timezone: string | null;
  locale: string | null;
}

export interface RegionBody {
  name: string;
  parentId: string | null;
  status: string;
  description: string | null;
  managerId: string | null;
  timezone: string | null;
  currencyCode: string | null;
}

export interface DepartmentBody {
  name: string;
  branchId: string | null;
  status: string;
  code: string | null;
  description: string | null;
  headId: string | null;
  email: string | null;
}

export interface TeamBody {
  name: string;
  departmentId: string;
  managerId: string | null;
  description: string | null;
  email: string | null;
  status: string;
}

export interface RoleUpdateBody {
  name: string;
  dataScope: string;
  permissionCodes: string[];
  description: string | null;
}

/** Update endpoints replace every field, so partial edits must start from the full current record. */
export function userUpdateBody(user: AdminUser, patch: Partial<UserUpdateBody> = {}): UserUpdateBody {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    regionId: user.regionId,
    branchId: user.branchId,
    departmentId: user.departmentId,
    teamId: user.teamId,
    managerId: user.managerId,
    status: user.status,
    jobTitle: user.jobTitle ?? null,
    employeeCode: user.employeeCode ?? null,
    mobile: user.mobile ?? null,
    dateOfJoining: user.dateOfJoining ?? null,
    timezone: user.timezone ?? null,
    locale: user.locale ?? null,
    ...patch,
  };
}

export function regionUpdateBody(region: Region, patch: Partial<RegionBody> = {}): RegionBody {
  return {
    name: region.name,
    parentId: region.parentId,
    status: region.status,
    description: region.description ?? null,
    managerId: region.managerId ?? null,
    timezone: region.timezone ?? null,
    currencyCode: region.currencyCode ?? null,
    ...patch,
  };
}

export function departmentUpdateBody(department: Department, patch: Partial<DepartmentBody> = {}): DepartmentBody {
  return {
    name: department.name,
    branchId: department.branchId,
    status: department.status,
    code: department.code ?? null,
    description: department.description ?? null,
    headId: department.headId ?? null,
    email: department.email ?? null,
    ...patch,
  };
}

export function teamUpdateBody(team: Team, patch: Partial<TeamBody> = {}): TeamBody {
  return {
    name: team.name,
    departmentId: team.departmentId,
    managerId: team.managerId,
    description: team.description ?? null,
    email: team.email ?? null,
    status: team.status ?? "ACTIVE",
    ...patch,
  };
}

export function roleUpdateBody(role: Role, patch: Partial<RoleUpdateBody> = {}): RoleUpdateBody {
  return {
    name: role.name,
    dataScope: role.dataScope,
    permissionCodes: role.permissionCodes,
    description: role.description ?? null,
    ...patch,
  };
}

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export async function listOrganizations(): Promise<Organization[]> {
  const { data } = await api.get<ApiResponse<Organization[]>>("/organizations", { params: { size: 100 } });
  return unwrap(data);
}

export async function getOrganization(id: string): Promise<Organization> {
  const { data } = await api.get<ApiResponse<Organization>>(`/organizations/${id}`);
  return unwrap(data);
}

export async function updateOrganization(id: string, body: OrganizationUpdateBody): Promise<Organization> {
  const { data } = await api.put<ApiResponse<Organization>>(`/organizations/${id}`, body);
  return unwrap(data);
}

export async function listRegions(): Promise<Region[]> {
  const { data } = await api.get<ApiResponse<Region[]>>("/regions", { params: { size: 100 } });
  return unwrap(data);
}

export async function getRegion(id: string): Promise<Region> {
  const { data } = await api.get<ApiResponse<Region>>(`/regions/${id}`);
  return unwrap(data);
}

export async function createRegion(body: Partial<RegionBody> & { name: string; code: string }): Promise<Region> {
  const { data } = await api.post<ApiResponse<Region>>("/regions", body);
  return unwrap(data);
}

export async function updateRegion(id: string, body: RegionBody): Promise<Region> {
  const { data } = await api.put<ApiResponse<Region>>(`/regions/${id}`, body);
  return unwrap(data);
}

export async function listBranches(): Promise<Branch[]> {
  const { data } = await api.get<ApiResponse<Branch[]>>("/branches", { params: { size: 100 } });
  return unwrap(data);
}

export async function listDepartments(): Promise<Department[]> {
  const { data } = await api.get<ApiResponse<Department[]>>("/departments", { params: { size: 100 } });
  return unwrap(data);
}

export async function getDepartment(id: string): Promise<Department> {
  const { data } = await api.get<ApiResponse<Department>>(`/departments/${id}`);
  return unwrap(data);
}

export async function createDepartment(body: Partial<DepartmentBody> & { name: string }): Promise<Department> {
  const { data } = await api.post<ApiResponse<Department>>("/departments", body);
  return unwrap(data);
}

export async function updateDepartment(id: string, body: DepartmentBody): Promise<Department> {
  const { data } = await api.put<ApiResponse<Department>>(`/departments/${id}`, body);
  return unwrap(data);
}

export async function listTeams(search?: string): Promise<Team[]> {
  const { data } = await api.get<ApiResponse<Team[]>>("/teams", {
    params: { size: 100, search: search || undefined },
  });
  return unwrap(data);
}

export async function getTeam(id: string): Promise<Team> {
  const { data } = await api.get<ApiResponse<Team>>(`/teams/${id}`);
  return unwrap(data);
}

export async function createTeam(body: Partial<TeamBody> & { departmentId: string; name: string }): Promise<Team> {
  const { data } = await api.post<ApiResponse<Team>>("/teams", body);
  return unwrap(data);
}

export async function updateTeam(id: string, body: TeamBody): Promise<Team> {
  const { data } = await api.put<ApiResponse<Team>>(`/teams/${id}`, body);
  return unwrap(data);
}

export async function listUsers(search?: string): Promise<AdminUser[]> {
  const { data } = await api.get<ApiResponse<AdminUser[]>>("/users", {
    params: { size: 100, search: search || undefined },
  });
  return unwrap(data);
}

export async function getUser(id: string): Promise<AdminUser> {
  const { data } = await api.get<ApiResponse<AdminUser>>(`/users/${id}`);
  return unwrap(data);
}

export async function createUser(body: UserCreateBody): Promise<AdminUser> {
  const { data } = await api.post<ApiResponse<AdminUser>>("/users", body);
  return unwrap(data);
}

export async function updateUser(id: string, body: UserUpdateBody): Promise<AdminUser> {
  const { data } = await api.put<ApiResponse<AdminUser>>(`/users/${id}`, body);
  return unwrap(data);
}

export async function assignUserRoles(userId: string, roleIds: string[]): Promise<AdminUser> {
  const { data } = await api.post<ApiResponse<AdminUser>>(`/users/${userId}/roles`, { roleIds });
  return unwrap(data);
}

export async function assignUserRegions(userId: string, regionIds: string[]): Promise<AdminUser> {
  const { data } = await api.post<ApiResponse<AdminUser>>(`/users/${userId}/regions`, { regionIds });
  return unwrap(data);
}

export async function deactivateUser(userId: string): Promise<AdminUser> {
  const { data } = await api.post<ApiResponse<AdminUser>>(`/users/${userId}/deactivate`);
  return unwrap(data);
}

export async function listRoles(): Promise<Role[]> {
  const { data } = await api.get<ApiResponse<Role[]>>("/roles");
  return unwrap(data);
}

export async function getRole(id: string): Promise<Role> {
  const { data } = await api.get<ApiResponse<Role>>(`/roles/${id}`);
  return unwrap(data);
}

export async function listPermissions(): Promise<Permission[]> {
  const { data } = await api.get<ApiResponse<Permission[]>>("/permissions");
  return unwrap(data);
}

export async function createRole(body: {
  code: string;
  name: string;
  dataScope: string;
  permissionCodes: string[];
  description?: string | null;
}): Promise<Role> {
  const { data } = await api.post<ApiResponse<Role>>("/roles", body);
  return unwrap(data);
}

export async function updateRole(id: string, body: RoleUpdateBody): Promise<Role> {
  const { data } = await api.put<ApiResponse<Role>>(`/roles/${id}`, body);
  return unwrap(data);
}

export async function listAuditLogs(params?: {
  action?: string;
  entityType?: string;
  userId?: string;
  regionId?: string;
  entityId?: string;
  from?: string;
  to?: string;
  size?: number;
}): Promise<AuditLog[]> {
  const { data } = await api.get<ApiResponse<AuditLog[]>>("/audit-logs", {
    params: {
      size: params?.size ?? 50,
      action: params?.action || undefined,
      entityType: params?.entityType || undefined,
      userId: params?.userId || undefined,
      regionId: params?.regionId || undefined,
      entityId: params?.entityId || undefined,
      from: params?.from || undefined,
      to: params?.to || undefined,
    },
  });
  return unwrap(data);
}
