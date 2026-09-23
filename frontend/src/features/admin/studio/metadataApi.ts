import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

function assertSuccess(response: ApiResponse<unknown>, fallback = "Request failed"): void {
  if (!response.success) {
    throw new Error(response.message ?? fallback);
  }
}

export interface SysTable {
  id: string;
  organizationId: string | null;
  code: string;
  label: string;
  plural: string;
  moduleGroup: string;
  active: boolean;
  system: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SysField {
  id: string;
  organizationId: string | null;
  tableId: string;
  code: string;
  label: string;
  helpText: string | null;
  fieldType: string;
  mandatory: boolean;
  defaultValue: string | null;
  referenceTableCode: string | null;
  active: boolean;
  filterable: boolean;
  system: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function listSysTables(): Promise<SysTable[]> {
  const { data } = await api.get<ApiResponse<SysTable[]>>("/metadata/tables");
  return unwrap(data);
}

export async function getSysTable(id: string): Promise<SysTable> {
  const { data } = await api.get<ApiResponse<SysTable>>(`/metadata/tables/${id}`);
  return unwrap(data);
}

export async function updateSysTable(
  id: string,
  body: { label?: string; plural?: string; active?: boolean },
): Promise<SysTable> {
  const { data } = await api.put<ApiResponse<SysTable>>(`/metadata/tables/${id}`, body);
  return unwrap(data);
}

export async function listSysFields(tableId: string): Promise<SysField[]> {
  const { data } = await api.get<ApiResponse<SysField[]>>(`/metadata/tables/${tableId}/fields`);
  return unwrap(data);
}

export async function createSysField(
  tableId: string,
  body: {
    code: string;
    label: string;
    helpText?: string;
    fieldType: string;
    mandatory?: boolean;
    defaultValue?: string;
    referenceTableCode?: string;
    filterable?: boolean;
    sortOrder?: number;
  },
): Promise<SysField> {
  const { data } = await api.post<ApiResponse<SysField>>(`/metadata/tables/${tableId}/fields`, body);
  return unwrap(data);
}

export async function updateSysField(
  id: string,
  body: {
    label?: string;
    helpText?: string;
    fieldType?: string;
    mandatory?: boolean;
    defaultValue?: string;
    referenceTableCode?: string;
    active?: boolean;
    filterable?: boolean;
    sortOrder?: number;
  },
): Promise<SysField> {
  const { data } = await api.put<ApiResponse<SysField>>(`/metadata/fields/${id}`, body);
  return unwrap(data);
}

export async function deactivateSysField(id: string): Promise<void> {
  const { data } = await api.delete<ApiResponse<null>>(`/metadata/fields/${id}`);
  assertSuccess(data);
}

export interface FormLayoutSection {
  id: string;
  title: string;
  disclosure: "ALWAYS" | "MORE";
  fields: string[];
}

export interface FormLayoutJson {
  sections: FormLayoutSection[];
}

export interface FormLayout {
  id: string;
  organizationId: string | null;
  tableId: string;
  layoutKey: string;
  status: string;
  layout: FormLayoutJson;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ListLayoutColumn {
  field: string;
  label: string;
  width?: number;
}

export interface ListLayoutJson {
  columns: ListLayoutColumn[];
  defaultSort?: { field: string; direction: "ASC" | "DESC" };
}

export interface ListLayout {
  id: string;
  organizationId: string | null;
  tableId: string;
  roleId: string | null;
  status: string;
  layout: ListLayoutJson;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export async function getFormLayout(tableId: string, layoutKey = "CREATE"): Promise<FormLayout> {
  const { data } = await api.get<ApiResponse<FormLayout>>(`/metadata/tables/${tableId}/form-layouts`, {
    params: { layoutKey },
  });
  return unwrap(data);
}

export async function saveFormLayoutDraft(
  tableId: string,
  body: { layoutKey: string; layout: FormLayoutJson },
): Promise<FormLayout> {
  const { data } = await api.put<ApiResponse<FormLayout>>(`/metadata/tables/${tableId}/form-layouts`, body);
  return unwrap(data);
}

export async function publishFormLayout(tableId: string, layoutKey = "CREATE"): Promise<FormLayout> {
  const { data } = await api.post<ApiResponse<FormLayout>>(
    `/metadata/tables/${tableId}/form-layouts/publish`,
    null,
    { params: { layoutKey } },
  );
  return unwrap(data);
}

export async function discardFormLayoutDraft(tableId: string, layoutKey = "CREATE"): Promise<void> {
  const { data } = await api.delete<ApiResponse<null>>(`/metadata/tables/${tableId}/form-layouts/draft`, {
    params: { layoutKey },
  });
  assertSuccess(data);
}

export async function getListLayout(tableId: string, roleId?: string | null): Promise<ListLayout> {
  const { data } = await api.get<ApiResponse<ListLayout>>(`/metadata/tables/${tableId}/list-layouts`, {
    params: roleId ? { roleId } : undefined,
  });
  return unwrap(data);
}

export async function saveListLayoutDraft(
  tableId: string,
  body: { roleId?: string | null; layout: ListLayoutJson },
): Promise<ListLayout> {
  const { data } = await api.put<ApiResponse<ListLayout>>(`/metadata/tables/${tableId}/list-layouts`, body);
  return unwrap(data);
}

export async function publishListLayout(tableId: string, roleId?: string | null): Promise<ListLayout> {
  const { data } = await api.post<ApiResponse<ListLayout>>(
    `/metadata/tables/${tableId}/list-layouts/publish`,
    null,
    { params: roleId ? { roleId } : undefined },
  );
  return unwrap(data);
}

export async function discardListLayoutDraft(tableId: string, roleId?: string | null): Promise<void> {
  const { data } = await api.delete<ApiResponse<null>>(`/metadata/tables/${tableId}/list-layouts/draft`, {
    params: roleId ? { roleId } : undefined,
  });
  assertSuccess(data);
}

export async function getPublishedFormLayout(
  tableCode: string,
  layoutKey = "CREATE",
): Promise<FormLayout> {
  const { data } = await api.get<ApiResponse<FormLayout>>(
    `/metadata/runtime/tables/${tableCode}/form-layout`,
    { params: { layoutKey } },
  );
  return unwrap(data);
}

export interface RuntimeFormBundle {
  layout: FormLayout;
  fields: SysField[];
}

export async function getPublishedFormBundle(
  tableCode: string,
  layoutKey = "CREATE",
): Promise<RuntimeFormBundle> {
  const { data } = await api.get<ApiResponse<RuntimeFormBundle>>(
    `/metadata/runtime/tables/${tableCode}/form-bundle`,
    { params: { layoutKey } },
  );
  return unwrap(data);
}

export async function getPublishedListLayout(
  tableCode: string,
  roleId?: string | null,
): Promise<ListLayout> {
  const { data } = await api.get<ApiResponse<ListLayout>>(
    `/metadata/runtime/tables/${tableCode}/list-layout`,
    { params: roleId ? { roleId } : undefined },
  );
  return unwrap(data);
}

export interface FilterFieldCatalogItem {
  code: string;
  label: string;
  fieldType: string;
  referenceTableCode: string | null;
}

export async function getFilterFieldCatalog(tableCode: string): Promise<FilterFieldCatalogItem[]> {
  const { data } = await api.get<ApiResponse<FilterFieldCatalogItem[]>>(
    `/metadata/runtime/tables/${tableCode}/filter-fields`,
  );
  return unwrap(data);
}

export async function getUserListPref(tableCode: string): Promise<{ tableCode: string; columns: ListLayoutColumn[] }> {
  const { data } = await api.get<ApiResponse<{ tableCode: string; columns: ListLayoutColumn[] }>>(
    `/metadata/list-prefs/${tableCode}`,
  );
  const body = unwrap(data);
  const columns = Array.isArray(body.columns) ? body.columns : [];
  return { tableCode: body.tableCode, columns };
}

export async function saveUserListPref(tableCode: string, columns: ListLayoutColumn[]): Promise<void> {
  const { data } = await api.put<ApiResponse<unknown>>(`/metadata/list-prefs/${tableCode}`, columns);
  assertSuccess(data);
}

export interface FormPolicy {
  id: string;
  organizationId: string | null;
  tableId: string;
  layoutKey: string;
  name: string;
  status: string;
  policy: {
    when: { field: string; op: string; value?: string };
    then: { field: string; visible?: boolean; mandatory?: boolean; readOnly?: boolean }[];
  };
  active: boolean;
  publishedAt: string | null;
}

export async function listFormPolicies(tableId: string): Promise<FormPolicy[]> {
  const { data } = await api.get<ApiResponse<FormPolicy[]>>(`/metadata/tables/${tableId}/form-policies`);
  return unwrap(data);
}

export async function createFormPolicy(
  tableId: string,
  body: { name: string; layoutKey?: string; policy: FormPolicy["policy"]; active?: boolean },
): Promise<FormPolicy> {
  const { data } = await api.post<ApiResponse<FormPolicy>>(`/metadata/tables/${tableId}/form-policies`, body);
  return unwrap(data);
}

export async function publishFormPolicy(policyId: string): Promise<FormPolicy> {
  const { data } = await api.post<ApiResponse<FormPolicy>>(`/metadata/form-policies/${policyId}/publish`);
  return unwrap(data);
}

export async function getPublishedFormPolicies(
  tableCode: string,
  layoutKey = "EDIT",
): Promise<FormPolicy[]> {
  const { data } = await api.get<ApiResponse<FormPolicy[]>>(
    `/metadata/runtime/tables/${tableCode}/form-policies`,
    { params: { layoutKey } },
  );
  return unwrap(data);
}

export interface RelatedListLayout {
  id: string;
  organizationId: string | null;
  parentTableId: string;
  childTableCode: string;
  label: string;
  sortOrder: number;
  permissionCode: string | null;
  columns: ListLayoutColumn[];
  status: string;
  active: boolean;
}

export async function getPublishedRelatedLists(tableCode: string): Promise<RelatedListLayout[]> {
  const { data } = await api.get<ApiResponse<RelatedListLayout[]>>(
    `/metadata/runtime/tables/${tableCode}/related-lists`,
  );
  return unwrap(data);
}

export async function listRelatedLists(tableId: string): Promise<RelatedListLayout[]> {
  const { data } = await api.get<ApiResponse<RelatedListLayout[]>>(`/metadata/tables/${tableId}/related-lists`);
  return unwrap(data);
}

export async function saveRelatedList(
  tableId: string,
  body: {
    childTableCode: string;
    label: string;
    sortOrder?: number;
    permissionCode?: string;
    columns?: ListLayoutColumn[];
    active?: boolean;
  },
): Promise<RelatedListLayout> {
  const { data } = await api.put<ApiResponse<RelatedListLayout>>(`/metadata/tables/${tableId}/related-lists`, body);
  return unwrap(data);
}

export async function publishRelatedList(id: string): Promise<RelatedListLayout> {
  const { data } = await api.post<ApiResponse<RelatedListLayout>>(`/metadata/related-lists/${id}/publish`);
  return unwrap(data);
}

export interface TableAclRow {
  id: string;
  organizationId: string;
  roleId: string;
  tableId: string;
  tableCode: string;
  roleCode: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export async function listTableAcls(): Promise<TableAclRow[]> {
  const { data } = await api.get<ApiResponse<TableAclRow[]>>("/metadata/table-acls");
  return unwrap(data);
}

export async function upsertTableAcl(body: {
  roleId: string;
  tableId: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}): Promise<TableAclRow> {
  const { data } = await api.put<ApiResponse<TableAclRow>>("/metadata/table-acls", body);
  return unwrap(data);
}

export async function getMyTableAcls(): Promise<Record<string, Record<string, boolean>>> {
  const { data } = await api.get<ApiResponse<Record<string, Record<string, boolean>>>>("/metadata/table-acls/me");
  return unwrap(data);
}

export interface FieldAclRow {
  id: string;
  organizationId: string;
  roleId: string;
  fieldId: string;
  tableCode: string;
  fieldCode: string;
  roleCode: string;
  accessLevel: "HIDDEN" | "READ" | "WRITE" | string;
}

export async function listFieldAcls(tableId: string): Promise<FieldAclRow[]> {
  const { data } = await api.get<ApiResponse<FieldAclRow[]>>("/metadata/field-acls", {
    params: { tableId },
  });
  return unwrap(data);
}

export async function upsertFieldAcl(body: {
  roleId: string;
  fieldId: string;
  accessLevel: string;
}): Promise<FieldAclRow> {
  const { data } = await api.put<ApiResponse<FieldAclRow>>("/metadata/field-acls", body);
  return unwrap(data);
}

export async function getMyFieldAcls(tableCode: string): Promise<Record<string, string>> {
  const { data } = await api.get<ApiResponse<Record<string, string>>>("/metadata/field-acls/me", {
    params: { tableCode },
  });
  return unwrap(data);
}
