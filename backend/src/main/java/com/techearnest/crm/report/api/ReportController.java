package com.techearnest.crm.report.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.report.api.dto.ReportDtos.ProcurementSpendReport;
import com.techearnest.crm.report.api.dto.ReportDtos.ProjectProfitabilityReport;
import com.techearnest.crm.report.api.dto.ReportDtos.ProjectTimesheetReport;
import com.techearnest.crm.report.api.dto.ReportDtos.ReceivablesAgingReport;
import com.techearnest.crm.report.api.dto.ReportDtos.ReportFilterRequest;
import com.techearnest.crm.report.api.dto.ReportDtos.ResourceUtilizationReport;
import com.techearnest.crm.report.api.dto.ReportDtos.SalesPipelineReport;
import com.techearnest.crm.report.application.ReportService;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/sales")
    public ApiResponse<SalesPipelineReport> sales(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        return ApiResponse.ok(reportService.salesPipeline(
                new ReportFilterRequest(organizationId, regionId, fromDate, toDate)));
    }

    @GetMapping("/projects")
    public ApiResponse<ProjectTimesheetReport> projects(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        return ApiResponse.ok(reportService.projectTimesheet(
                new ReportFilterRequest(organizationId, regionId, fromDate, toDate)));
    }

    @GetMapping("/receivables")
    public ApiResponse<ReceivablesAgingReport> receivables(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        return ApiResponse.ok(reportService.receivables(
                new ReportFilterRequest(organizationId, regionId, fromDate, toDate)));
    }

    @GetMapping("/profitability")
    public ApiResponse<ProjectProfitabilityReport> profitability(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        return ApiResponse.ok(reportService.profitability(
                new ReportFilterRequest(organizationId, regionId, fromDate, toDate)));
    }

    @GetMapping("/utilization")
    public ApiResponse<ResourceUtilizationReport> utilization(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        return ApiResponse.ok(reportService.resourceUtilization(
                new ReportFilterRequest(organizationId, regionId, fromDate, toDate)));
    }

    @GetMapping("/spend")
    public ApiResponse<ProcurementSpendReport> spend(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        return ApiResponse.ok(reportService.procurementSpend(
                new ReportFilterRequest(organizationId, regionId, fromDate, toDate)));
    }
}
