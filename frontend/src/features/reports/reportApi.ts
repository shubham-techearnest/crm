import type { ApiResponse } from "@/types/api";
import api from "@/api/client";

function unwrap<T>(response: ApiResponse<T>, fallback = "Request failed"): T {
  if (!response.data) {
    throw new Error(response.message ?? fallback);
  }
  return response.data;
}

export interface SalesPipelineReport {
  leadsByStatus: Record<string, number>;
  dealsByStage: Record<string, number>;
  wonDeals: number;
  lostDeals: number;
  pipelineValue: number;
  wonValue: number;
}

export interface ProjectTimesheetReport {
  projectsByStatus: Record<string, number>;
  delayedProjects: number;
  billableHours: number;
  nonBillableHours: number;
  approvedTimesheets: number;
  pendingTimesheets: number;
}

export interface ReceivablesAgingReport {
  totalOutstanding: number;
  agingBuckets: Record<string, number>;
  openInvoiceCount: number;
}

export interface ProjectProfitabilityRow {
  projectId: string;
  projectName: string;
  revenue: number;
  cost: number;
  expenses: number;
  margin: number;
}

export interface ProjectProfitabilityReport {
  rows: ProjectProfitabilityRow[];
}

export interface ResourceUtilizationRow {
  resourceId: string;
  employeeCode: string;
  designation: string | null;
  utilizationPercent: number;
  overAllocated: boolean;
}

export interface ResourceUtilizationReport {
  periodStart: string;
  periodEnd: string;
  rows: ResourceUtilizationRow[];
}

export interface ProcurementSpendReport {
  purchaseOrderTotal: number;
  expenseTotal: number;
  expensesByCategory: Record<string, number>;
  purchaseOrdersByStatus: Record<string, number>;
}

export type ReportParams = {
  regionId?: string;
  fromDate?: string;
  toDate?: string;
};

export async function getSalesPipelineReport(params?: ReportParams): Promise<SalesPipelineReport> {
  const { data } = await api.get<ApiResponse<SalesPipelineReport>>("/reports/sales", { params });
  return unwrap(data);
}

export async function getProjectTimesheetReport(params?: ReportParams): Promise<ProjectTimesheetReport> {
  const { data } = await api.get<ApiResponse<ProjectTimesheetReport>>("/reports/projects", { params });
  return unwrap(data);
}

export async function getReceivablesReport(params?: ReportParams): Promise<ReceivablesAgingReport> {
  const { data } = await api.get<ApiResponse<ReceivablesAgingReport>>("/reports/receivables", { params });
  return unwrap(data);
}

export async function getProfitabilityReport(params?: ReportParams): Promise<ProjectProfitabilityReport> {
  const { data } = await api.get<ApiResponse<ProjectProfitabilityReport>>("/reports/profitability", { params });
  return unwrap(data);
}

export async function getUtilizationReport(params?: ReportParams): Promise<ResourceUtilizationReport> {
  const { data } = await api.get<ApiResponse<ResourceUtilizationReport>>("/reports/utilization", { params });
  return unwrap(data);
}

export async function getSpendReport(params?: ReportParams): Promise<ProcurementSpendReport> {
  const { data } = await api.get<ApiResponse<ProcurementSpendReport>>("/reports/spend", { params });
  return unwrap(data);
}
