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
}

export interface Department {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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

export async function updateOrganization(
  id: string,
  body: {
    name: string;
    legalName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    timezone?: string;
    locale?: string;
    currencyCode?: string;
    status?: string;
  },
): Promise<Organization> {
  const { data } = await api.put<ApiResponse<Organization>>(`/organizations/${id}`, body);
  return unwrap(data);
}

export async function listRegions(): Promise<Region[]> {
  const { data } = await api.get<ApiResponse<Region[]>>("/regions", { params: { size: 100 } });
  return unwrap(data);
}

export async function createRegion(body: {
  name: string;
  code: string;
  parentId?: string | null;
}): Promise<Region> {
  const { data } = await api.post<ApiResponse<Region>>("/regions", body);
  return unwrap(data);
}

export async function listDepartments(): Promise<Department[]> {
  const { data } = await api.get<ApiResponse<Department[]>>("/departments", { params: { size: 100 } });
  return unwrap(data);
}

export async function createDepartment(body: { name: string; branchId?: string | null }): Promise<Department> {
  const { data } = await api.post<ApiResponse<Department>>("/departments", body);
  return unwrap(data);
}

export async function listUsers(search?: string): Promise<AdminUser[]> {
  const { data } = await api.get<ApiResponse<AdminUser[]>>("/users", {
    params: { size: 100, search: search || undefined },
  });
  return unwrap(data);
}

export async function createUser(body: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  regionId?: string | null;
  departmentId?: string | null;
  roleIds?: string[];
}): Promise<AdminUser> {
  const { data } = await api.post<ApiResponse<AdminUser>>("/users", body);
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

export async function listPermissions(): Promise<Permission[]> {
  const { data } = await api.get<ApiResponse<Permission[]>>("/permissions");
  return unwrap(data);
}

export async function createRole(body: {
  code: string;
  name: string;
  dataScope: string;
  permissionCodes: string[];
}): Promise<Role> {
  const { data } = await api.post<ApiResponse<Role>>("/roles", body);
  return unwrap(data);
}

export async function updateRole(
  id: string,
  body: { name: string; dataScope?: string; permissionCodes: string[] },
): Promise<Role> {
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
