import type { ApiResponse } from "@/types/api";
import api from "@/api/client";
import type { Project } from "@/features/projects/projectApi";

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

export interface Lead {
  id: string;
  organizationId: string;
  regionId: string;
  ownerId: string | null;
  salutation: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  website: string | null;
  source: string | null;
  emailOptOut: boolean;
  noOfEmployees: number | null;
  rating: string | null;
  skypeId: string | null;
  secondaryEmail: string | null;
  twitter: string | null;
  addressCountry: string | null;
  addressFlat: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  addressLatitude: number | null;
  addressLongitude: number | null;
  photoDocumentId: string | null;
  status: string;
  priority: string | null;
  industry: string | null;
  designation: string | null;
  estimatedValue: number | null;
  expectedCloseDate: string | null;
  description: string | null;
  convertedAccountId: string | null;
  convertedContactId: string | null;
  convertedDealId: string | null;
  convertedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadBody {
  regionId: string;
  ownerId?: string | null;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  source?: string;
  emailOptOut?: boolean;
  noOfEmployees?: number | null;
  rating?: string;
  skypeId?: string;
  secondaryEmail?: string;
  twitter?: string;
  addressCountry?: string;
  addressFlat?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressLatitude?: number | null;
  addressLongitude?: number | null;
  photoDocumentId?: string | null;
  status?: string;
  priority?: string;
  industry?: string;
  designation?: string;
  estimatedValue?: number | null;
  expectedCloseDate?: string | null;
  description?: string;
}

export interface UpdateLeadBody {
  regionId?: string;
  ownerId?: string | null;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  source?: string;
  emailOptOut?: boolean;
  noOfEmployees?: number | null;
  rating?: string;
  skypeId?: string;
  secondaryEmail?: string;
  twitter?: string;
  addressCountry?: string;
  addressFlat?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressLatitude?: number | null;
  addressLongitude?: number | null;
  photoDocumentId?: string | null;
  status?: string;
  priority?: string;
  industry?: string;
  designation?: string;
  estimatedValue?: number | null;
  expectedCloseDate?: string | null;
  description?: string;
}

export interface ConvertLeadBody {
  createAccount?: boolean;
  createContact?: boolean;
  createDeal?: boolean;
  accountId?: string | null;
  dealName?: string;
  dealValue?: number | null;
  dealStage?: string;
}

export interface ConvertLeadResult {
  accountId: string | null;
  contactId: string | null;
  dealId: string | null;
}

export interface Account {
  id: string;
  organizationId: string;
  regionId: string;
  ownerId: string | null;
  name: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  taxNumber: string | null;
  status: string;
  accountType: string;
  description: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountBody {
  regionId: string;
  ownerId?: string | null;
  name: string;
  industry?: string;
  website?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  taxNumber?: string;
  status?: string;
  accountType: string;
  description?: string;
}

export interface UpdateAccountBody {
  regionId?: string;
  ownerId?: string | null;
  name: string;
  industry?: string;
  website?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  taxNumber?: string;
  status?: string;
  accountType?: string;
  description?: string;
}

export interface Contact {
  id: string;
  organizationId: string;
  regionId: string;
  accountId: string;
  ownerId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  designation: string | null;
  department: string | null;
  linkedinUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactBody {
  accountId: string;
  ownerId?: string | null;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  designation?: string;
  department?: string;
  linkedinUrl?: string;
  status?: string;
  notes?: string;
}

export interface UpdateContactBody {
  ownerId?: string | null;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  designation?: string;
  department?: string;
  linkedinUrl?: string;
  status?: string;
  notes?: string;
}

export interface Deal {
  id: string;
  organizationId: string;
  regionId: string;
  accountId: string;
  contactId: string | null;
  ownerId: string | null;
  leadId: string | null;
  name: string;
  stage: string;
  value: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  source: string | null;
  description: string | null;
  competitor: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDealBody {
  accountId: string;
  contactId?: string | null;
  ownerId?: string | null;
  leadId?: string | null;
  name: string;
  stage?: string;
  value?: number | null;
  probability?: number | null;
  expectedCloseDate?: string | null;
  source?: string;
  description?: string;
  competitor?: string;
}

export interface UpdateDealBody {
  contactId?: string | null;
  ownerId?: string | null;
  name: string;
  value?: number | null;
  probability?: number | null;
  expectedCloseDate?: string | null;
  source?: string;
  description?: string;
  competitor?: string;
}

export interface PipelineColumn {
  stage: string;
  deals: Deal[];
  totalValue: number | null;
}

export interface Activity {
  id: string;
  organizationId: string;
  regionId: string | null;
  type: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  relatedEntityType: string;
  relatedEntityId: string;
  completedAt: string | null;
  location?: string | null;
  attendees?: string | null;
  outcome?: string | null;
  callDirection?: string | null;
  durationSeconds?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActivityBody {
  regionId?: string | null;
  type: string;
  subject: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assignedTo?: string | null;
  relatedEntityType: string;
  relatedEntityId: string;
  location?: string;
  attendees?: string;
  outcome?: string;
  callDirection?: string;
  durationSeconds?: number;
}

// —— Leads ——

export async function listLeads(params?: {
  search?: string;
  status?: string;
  source?: string;
  priority?: string;
  regionId?: string;
  ownerId?: string;
  sortBy?: string;
  sortDir?: string;
}): Promise<Lead[]> {
  const { data } = await api.get<ApiResponse<Lead[]>>("/leads", {
    params: {
      size: 100,
      search: params?.search || undefined,
      status: params?.status || undefined,
      source: params?.source || undefined,
      priority: params?.priority || undefined,
      regionId: params?.regionId || undefined,
      ownerId: params?.ownerId || undefined,
      sortBy: params?.sortBy || undefined,
      sortDir: params?.sortDir || undefined,
    },
  });
  return unwrap(data);
}

export async function queryLeads(body: {
  search?: string;
  filter?: {
    op?: string;
    conditions?: Array<{
      field?: string;
      operator?: string;
      value?: unknown;
      valueTo?: unknown;
      op?: string;
      conditions?: unknown[];
    }>;
    field?: string;
    operator?: string;
    value?: unknown;
  };
  sort?: Array<{ field: string; direction?: string }>;
  page?: number;
  size?: number;
}): Promise<Lead[]> {
  const { data } = await api.post<ApiResponse<Lead[]>>("/leads/query", body);
  return unwrap(data);
}

export async function getLead(id: string): Promise<Lead> {
  const { data } = await api.get<ApiResponse<Lead>>(`/leads/${id}`);
  return unwrap(data);
}

export async function createLead(body: CreateLeadBody): Promise<Lead> {
  const { data } = await api.post<ApiResponse<Lead>>("/leads", body);
  return unwrap(data);
}

export async function updateLead(id: string, body: UpdateLeadBody): Promise<Lead> {
  const { data } = await api.put<ApiResponse<Lead>>(`/leads/${id}`, body);
  return unwrap(data);
}

export async function assignLead(id: string, ownerId: string): Promise<Lead> {
  const { data } = await api.post<ApiResponse<Lead>>(`/leads/${id}/assign`, { ownerId });
  return unwrap(data);
}

export interface BulkLeadResult {
  succeeded: number;
  failed: number;
  failures: { leadId: string; reason: string }[];
}

export async function bulkAssignLeads(leadIds: string[], ownerId: string): Promise<BulkLeadResult> {
  const { data } = await api.post<ApiResponse<BulkLeadResult>>("/leads/bulk-assign", { leadIds, ownerId });
  return unwrap(data);
}

export async function bulkStatusLeads(leadIds: string[], status: string): Promise<BulkLeadResult> {
  const { data } = await api.post<ApiResponse<BulkLeadResult>>("/leads/bulk-status", { leadIds, status });
  return unwrap(data);
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  matches: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    email: string | null;
    status: string;
  }[];
}

export async function checkLeadDuplicates(body: {
  email?: string;
  companyName?: string;
}): Promise<DuplicateCheckResult> {
  const { data } = await api.post<ApiResponse<DuplicateCheckResult>>("/leads/duplicate-check", body);
  return unwrap(data);
}

export async function convertLead(id: string, body: ConvertLeadBody): Promise<ConvertLeadResult> {
  const { data } = await api.post<ApiResponse<ConvertLeadResult>>(`/leads/${id}/convert`, body);
  return unwrap(data);
}

export async function deleteLead(id: string): Promise<void> {
  const { data } = await api.delete<ApiResponse<null>>(`/leads/${id}`);
  assertSuccess(data, "Could not delete lead");
}

export async function exportLeads(columns?: string[]): Promise<void> {
  const { data } = await api.get<string>("/leads/export", {
    responseType: "text",
    params: columns?.length ? { columns } : undefined,
  });
  const blob = new Blob([data], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "leads.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importLeads(rows: CreateLeadBody[]): Promise<{ imported: number }> {
  const { data } = await api.post<ApiResponse<{ imported: number }>>("/leads/import", rows);
  return unwrap(data);
}

// —— Accounts ——

export async function listAccounts(params?: {
  search?: string;
  status?: string;
  accountType?: string;
  industry?: string;
  regionId?: string;
}): Promise<Account[]> {
  const { data } = await api.get<ApiResponse<Account[]>>("/accounts", {
    params: {
      size: 100,
      search: params?.search || undefined,
      status: params?.status || undefined,
      accountType: params?.accountType || undefined,
      industry: params?.industry || undefined,
      regionId: params?.regionId || undefined,
    },
  });
  return unwrap(data);
}

export async function getAccount(id: string): Promise<Account> {
  const { data } = await api.get<ApiResponse<Account>>(`/accounts/${id}`);
  return unwrap(data);
}

export async function createAccount(body: CreateAccountBody): Promise<Account> {
  const { data } = await api.post<ApiResponse<Account>>("/accounts", body);
  return unwrap(data);
}

export async function updateAccount(id: string, body: UpdateAccountBody): Promise<Account> {
  const { data } = await api.put<ApiResponse<Account>>(`/accounts/${id}`, body);
  return unwrap(data);
}

export async function listAccountContacts(accountId: string): Promise<Contact[]> {
  const { data } = await api.get<ApiResponse<Contact[]>>(`/accounts/${accountId}/contacts`, {
    params: { size: 100 },
  });
  return unwrap(data);
}

export async function listAccountDeals(accountId: string): Promise<Deal[]> {
  const { data } = await api.get<ApiResponse<Deal[]>>(`/accounts/${accountId}/deals`, {
    params: { size: 100 },
  });
  return unwrap(data);
}

export async function listAccountProjects(accountId: string): Promise<Project[]> {
  const { data } = await api.get<ApiResponse<Project[]>>(`/accounts/${accountId}/projects`, {
    params: { size: 100 },
  });
  return unwrap(data);
}

// —— Contacts ——

export async function listContacts(params?: {
  search?: string;
  accountId?: string;
  status?: string;
  ownerId?: string;
  email?: string;
  designation?: string;
}): Promise<Contact[]> {
  const { data } = await api.get<ApiResponse<Contact[]>>("/contacts", {
    params: {
      size: 100,
      search: params?.search || undefined,
      accountId: params?.accountId || undefined,
      status: params?.status || undefined,
      ownerId: params?.ownerId || undefined,
      email: params?.email || undefined,
      designation: params?.designation || undefined,
    },
  });
  return unwrap(data);
}

export async function getContact(id: string): Promise<Contact> {
  const { data } = await api.get<ApiResponse<Contact>>(`/contacts/${id}`);
  return unwrap(data);
}

export async function createContact(body: CreateContactBody): Promise<Contact> {
  const { data } = await api.post<ApiResponse<Contact>>("/contacts", body);
  return unwrap(data);
}

export async function updateContact(id: string, body: UpdateContactBody): Promise<Contact> {
  const { data } = await api.put<ApiResponse<Contact>>(`/contacts/${id}`, body);
  return unwrap(data);
}

// —— Deals ——

export async function listDeals(params?: {
  search?: string;
  accountId?: string;
  stage?: string;
  ownerId?: string;
  minValue?: number;
  closeFrom?: string;
  closeTo?: string;
}): Promise<Deal[]> {
  const { data } = await api.get<ApiResponse<Deal[]>>("/deals", {
    params: {
      size: 100,
      search: params?.search || undefined,
      accountId: params?.accountId || undefined,
      stage: params?.stage || undefined,
      ownerId: params?.ownerId || undefined,
      minValue: params?.minValue,
      closeFrom: params?.closeFrom || undefined,
      closeTo: params?.closeTo || undefined,
    },
  });
  return unwrap(data);
}

export async function getDeal(id: string): Promise<Deal> {
  const { data } = await api.get<ApiResponse<Deal>>(`/deals/${id}`);
  return unwrap(data);
}

export async function createDeal(body: CreateDealBody): Promise<Deal> {
  const { data } = await api.post<ApiResponse<Deal>>("/deals", body);
  return unwrap(data);
}

export async function updateDeal(id: string, body: UpdateDealBody): Promise<Deal> {
  const { data } = await api.put<ApiResponse<Deal>>(`/deals/${id}`, body);
  return unwrap(data);
}

export async function changeDealStage(
  id: string,
  body: { toStage: string; lostReason?: string; expectedCloseDate?: string },
): Promise<Deal> {
  const { data } = await api.post<ApiResponse<Deal>>(`/deals/${id}/stage`, body);
  return unwrap(data);
}

export interface DealStageHistoryEntry {
  id: string;
  fromStage: string | null;
  toStage: string;
  changedBy: string;
  changedAt: string;
}

export async function listDealStageHistory(dealId: string): Promise<DealStageHistoryEntry[]> {
  const { data } = await api.get<ApiResponse<DealStageHistoryEntry[]>>(`/deals/${dealId}/stage-history`);
  return unwrap(data);
}

export async function getPipeline(): Promise<PipelineColumn[]> {
  const { data } = await api.get<ApiResponse<PipelineColumn[]>>("/deals/pipeline");
  return unwrap(data);
}

// —— Activities ——

export async function listActivities(params?: {
  relatedEntityType?: string;
  relatedEntityId?: string;
  status?: string;
  type?: string;
  assignedTo?: string;
  outcome?: string;
  callDirection?: string;
  dueFrom?: string;
  dueTo?: string;
}): Promise<Activity[]> {
  const { data } = await api.get<ApiResponse<Activity[]>>("/activities", {
    params: {
      size: 100,
      relatedEntityType: params?.relatedEntityType || undefined,
      relatedEntityId: params?.relatedEntityId || undefined,
      status: params?.status || undefined,
      type: params?.type || undefined,
      assignedTo: params?.assignedTo || undefined,
      outcome: params?.outcome || undefined,
      callDirection: params?.callDirection || undefined,
      dueFrom: params?.dueFrom || undefined,
      dueTo: params?.dueTo || undefined,
    },
  });
  return unwrap(data);
}

export async function createActivity(body: CreateActivityBody): Promise<Activity> {
  const { data } = await api.post<ApiResponse<Activity>>("/activities", body);
  return unwrap(data);
}

export async function completeActivity(id: string): Promise<Activity> {
  const { data } = await api.post<ApiResponse<Activity>>(`/activities/${id}/complete`);
  return unwrap(data);
}

export interface UpdateActivityBody {
  type?: string;
  subject: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assignedTo?: string | null;
  location?: string;
  attendees?: string;
  outcome?: string;
  callDirection?: string;
  durationSeconds?: number;
}

export async function updateActivity(id: string, body: UpdateActivityBody): Promise<Activity> {
  const { data } = await api.put<ApiResponse<Activity>>(`/activities/${id}`, body);
  return unwrap(data);
}
