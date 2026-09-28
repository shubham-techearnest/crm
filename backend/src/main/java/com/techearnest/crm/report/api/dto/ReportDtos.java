package com.techearnest.crm.report.api.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public final class ReportDtos {

    private ReportDtos() {}

    public record ReportFilterRequest(
            java.util.UUID organizationId,
            java.util.UUID regionId,
            java.time.LocalDate fromDate,
            java.time.LocalDate toDate) {}

    public record SalesPipelineReport(
            Map<String, Long> leadsByStatus,
            Map<String, Long> dealsByStage,
            long wonDeals,
            long lostDeals,
            BigDecimal pipelineValue,
            BigDecimal wonValue) {}

    public record ProjectTimesheetReport(
            Map<String, Long> projectsByStatus,
            long delayedProjects,
            BigDecimal billableHours,
            BigDecimal nonBillableHours,
            long approvedTimesheets,
            long pendingTimesheets) {}

    public record ReceivablesAgingReport(
            BigDecimal totalOutstanding,
            Map<String, BigDecimal> agingBuckets,
            long openInvoiceCount) {}

    public record ProjectProfitabilityRow(
            java.util.UUID projectId,
            String projectName,
            BigDecimal revenue,
            BigDecimal cost,
            BigDecimal expenses,
            BigDecimal margin) {}

    public record ProjectProfitabilityReport(List<ProjectProfitabilityRow> rows) {}

    public record ResourceUtilizationRow(
            java.util.UUID resourceId,
            String employeeCode,
            String designation,
            BigDecimal utilizationPercent,
            boolean overAllocated) {}

    public record ResourceUtilizationReport(
            java.time.LocalDate periodStart,
            java.time.LocalDate periodEnd,
            List<ResourceUtilizationRow> rows) {}

    public record ProcurementSpendReport(
            BigDecimal purchaseOrderTotal,
            BigDecimal expenseTotal,
            Map<String, BigDecimal> expensesByCategory,
            Map<String, BigDecimal> purchaseOrdersByStatus) {}
}
