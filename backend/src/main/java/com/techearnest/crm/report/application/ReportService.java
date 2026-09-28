package com.techearnest.crm.report.application;

import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.deal.domain.Deal;
import com.techearnest.crm.deal.domain.DealRepository;
import com.techearnest.crm.lead.domain.Lead;
import com.techearnest.crm.lead.domain.LeadRepository;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.expense.domain.Expense;
import com.techearnest.crm.expense.domain.ExpenseRepository;
import com.techearnest.crm.finance.domain.Invoice;
import com.techearnest.crm.finance.domain.InvoiceRepository;
import com.techearnest.crm.procurement.domain.PurchaseOrder;
import com.techearnest.crm.procurement.domain.PurchaseOrderRepository;
import com.techearnest.crm.report.api.dto.ReportDtos.ProcurementSpendReport;
import com.techearnest.crm.report.api.dto.ReportDtos.ProjectProfitabilityReport;
import com.techearnest.crm.report.api.dto.ReportDtos.ProjectProfitabilityRow;
import com.techearnest.crm.report.api.dto.ReportDtos.ResourceUtilizationReport;
import com.techearnest.crm.report.api.dto.ReportDtos.ResourceUtilizationRow;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UtilizationResponse;
import com.techearnest.crm.resource.application.UtilizationService;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.report.api.dto.ReportDtos.ProjectTimesheetReport;
import com.techearnest.crm.report.api.dto.ReportDtos.ReceivablesAgingReport;
import com.techearnest.crm.report.api.dto.ReportDtos.ReportFilterRequest;
import com.techearnest.crm.report.api.dto.ReportDtos.SalesPipelineReport;
import com.techearnest.crm.timesheet.domain.TimeEntry;
import com.techearnest.crm.timesheet.domain.TimeEntryRepository;
import com.techearnest.crm.timesheet.domain.Timesheet;
import com.techearnest.crm.timesheet.domain.TimesheetRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {

    private final TenantAccess tenantAccess;
    private final LeadRepository leadRepository;
    private final DealRepository dealRepository;
    private final ProjectRepository projectRepository;
    private final TimesheetRepository timesheetRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final InvoiceRepository invoiceRepository;
    private final ExpenseRepository expenseRepository;
    private final ResourceRepository resourceRepository;
    private final UtilizationService utilizationService;
    private final PurchaseOrderRepository purchaseOrderRepository;

    public ReportService(
            TenantAccess tenantAccess,
            LeadRepository leadRepository,
            DealRepository dealRepository,
            ProjectRepository projectRepository,
            TimesheetRepository timesheetRepository,
            TimeEntryRepository timeEntryRepository,
            InvoiceRepository invoiceRepository,
            ExpenseRepository expenseRepository,
            ResourceRepository resourceRepository,
            UtilizationService utilizationService,
            PurchaseOrderRepository purchaseOrderRepository) {
        this.tenantAccess = tenantAccess;
        this.leadRepository = leadRepository;
        this.dealRepository = dealRepository;
        this.projectRepository = projectRepository;
        this.timesheetRepository = timesheetRepository;
        this.timeEntryRepository = timeEntryRepository;
        this.invoiceRepository = invoiceRepository;
        this.expenseRepository = expenseRepository;
        this.resourceRepository = resourceRepository;
        this.utilizationService = utilizationService;
        this.purchaseOrderRepository = purchaseOrderRepository;
    }

    @Transactional(readOnly = true)
    public SalesPipelineReport salesPipeline(ReportFilterRequest request) {
        tenantAccess.requirePermission("REPORT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = scopedRegions(request == null ? null : request.regionId());
        LocalDate from = request == null ? null : request.fromDate();
        LocalDate to = request == null ? null : request.toDate();

        List<Lead> leads = leadRepository
                .search(orgId, null, regionIds, null, null, PageRequest.of(0, 5000))
                .getContent()
                .stream()
                .filter(lead -> inDateRange(lead.getCreatedAt() == null ? null : lead.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toLocalDate(), from, to))
                .toList();

        Map<String, Long> leadsByStatus = new HashMap<>();
        for (Lead lead : leads) {
            leadsByStatus.merge(lead.getStatus(), 1L, Long::sum);
        }

        List<Deal> deals = dealRepository.findForPipeline(orgId, regionIds, null).stream()
                .filter(deal -> inDateRange(deal.getCreatedAt() == null ? null : deal.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toLocalDate(), from, to))
                .toList();

        Map<String, Long> dealsByStage = new HashMap<>();
        long won = 0;
        long lost = 0;
        BigDecimal pipelineValue = BigDecimal.ZERO;
        BigDecimal wonValue = BigDecimal.ZERO;
        for (Deal deal : deals) {
            dealsByStage.merge(deal.getStage(), 1L, Long::sum);
            if ("WON".equalsIgnoreCase(deal.getStage())) {
                won++;
                wonValue = wonValue.add(deal.getValue() == null ? BigDecimal.ZERO : deal.getValue());
            } else if ("LOST".equalsIgnoreCase(deal.getStage())) {
                lost++;
            } else if (deal.getValue() != null) {
                pipelineValue = pipelineValue.add(deal.getValue());
            }
        }

        return new SalesPipelineReport(leadsByStatus, dealsByStage, won, lost, pipelineValue, wonValue);
    }

    @Transactional(readOnly = true)
    public ProjectTimesheetReport projectTimesheet(ReportFilterRequest request) {
        tenantAccess.requirePermission("REPORT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = scopedRegions(request == null ? null : request.regionId());
        LocalDate from = request == null ? null : request.fromDate();
        LocalDate to = request == null ? null : request.toDate();

        List<Project> projects = projectRepository
                .search(orgId, null, regionIds, null, null, null, null, null, null, false, PageRequest.of(0, 5000))
                .getContent();

        Map<String, Long> projectsByStatus = new HashMap<>();
        long delayed = 0;
        LocalDate today = LocalDate.now();
        for (Project project : projects) {
            projectsByStatus.merge(project.getStatus(), 1L, Long::sum);
            if (project.getEndDate() != null
                    && project.getEndDate().isBefore(today)
                    && !"COMPLETED".equalsIgnoreCase(project.getStatus())
                    && !"CLOSED".equalsIgnoreCase(project.getStatus())) {
                delayed++;
            }
        }

        List<Timesheet> timesheets = timesheetRepository
                .search(orgId, null, null, null, false, regionIds, null, PageRequest.of(0, 5000))
                .getContent()
                .stream()
                .filter(ts -> inDateRange(ts.getWeekStartDate(), from, to))
                .toList();

        long approved = timesheets.stream()
                .filter(ts -> Timesheet.STATUS_APPROVED.equals(ts.getStatus()))
                .count();
        long pending = timesheets.stream()
                .filter(ts -> Timesheet.STATUS_SUBMITTED.equals(ts.getStatus()))
                .count();

        BigDecimal billable = BigDecimal.ZERO;
        BigDecimal nonBillable = BigDecimal.ZERO;
        for (Timesheet ts : timesheets) {
            List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(ts.getId());
            for (TimeEntry entry : entries) {
                BigDecimal hours = entry.getHours() == null ? BigDecimal.ZERO : entry.getHours();
                if (entry.isBillable()) {
                    billable = billable.add(hours);
                } else {
                    nonBillable = nonBillable.add(hours);
                }
            }
        }

        return new ProjectTimesheetReport(
                projectsByStatus, delayed, billable, nonBillable, approved, pending);
    }

    @Transactional(readOnly = true)
    public ReceivablesAgingReport receivables(ReportFilterRequest request) {
        tenantAccess.requirePermission("REPORT_VIEW");
        tenantAccess.requirePermission("INVOICE_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = scopedRegions(request == null ? null : request.regionId());
        List<Invoice> invoices = invoiceRepository
                .search(orgId, null, regionIds, null, null, null, false, PageRequest.of(0, 5000))
                .getContent()
                .stream()
                .filter(inv -> inv.getBalanceDue() != null && inv.getBalanceDue().signum() > 0)
                .filter(inv -> !Invoice.STATUS_VOID.equals(inv.getStatus()))
                .filter(inv -> !Invoice.STATUS_DRAFT.equals(inv.getStatus()))
                .toList();

        Map<String, BigDecimal> buckets = new HashMap<>();
        buckets.put("current", BigDecimal.ZERO);
        buckets.put("1-30", BigDecimal.ZERO);
        buckets.put("31-60", BigDecimal.ZERO);
        buckets.put("61-90", BigDecimal.ZERO);
        buckets.put("90+", BigDecimal.ZERO);
        BigDecimal total = BigDecimal.ZERO;
        LocalDate today = LocalDate.now();
        for (Invoice invoice : invoices) {
            BigDecimal balance = invoice.getBalanceDue();
            total = total.add(balance);
            LocalDate due = invoice.getDueDate() == null ? today : invoice.getDueDate();
            long daysPast = due.isBefore(today) ? java.time.temporal.ChronoUnit.DAYS.between(due, today) : 0;
            if (daysPast <= 0) {
                buckets.merge("current", balance, BigDecimal::add);
            } else if (daysPast <= 30) {
                buckets.merge("1-30", balance, BigDecimal::add);
            } else if (daysPast <= 60) {
                buckets.merge("31-60", balance, BigDecimal::add);
            } else if (daysPast <= 90) {
                buckets.merge("61-90", balance, BigDecimal::add);
            } else {
                buckets.merge("90+", balance, BigDecimal::add);
            }
        }
        return new ReceivablesAgingReport(total, buckets, invoices.size());
    }

    @Transactional(readOnly = true)
    public ProjectProfitabilityReport profitability(ReportFilterRequest request) {
        tenantAccess.requirePermission("REPORT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = scopedRegions(request == null ? null : request.regionId());
        boolean canViewRates = tenantAccess.currentUser().hasPermission("RATE_VIEW");

        List<Project> projects = projectRepository
                .search(orgId, null, regionIds, null, null, null, null, null, null, false, PageRequest.of(0, 5000))
                .getContent();

        Map<UUID, BigDecimal> revenueByProject = invoiceRepository
                .search(orgId, null, regionIds, null, null, null, false, PageRequest.of(0, 5000))
                .getContent()
                .stream()
                .filter(inv -> inv.getProjectId() != null)
                .filter(inv -> Invoice.STATUS_ISSUED.equals(inv.getStatus())
                        || Invoice.STATUS_PARTIALLY_PAID.equals(inv.getStatus())
                        || Invoice.STATUS_PAID.equals(inv.getStatus())
                        || Invoice.STATUS_OVERDUE.equals(inv.getStatus()))
                .collect(Collectors.groupingBy(
                        Invoice::getProjectId,
                        Collectors.reducing(BigDecimal.ZERO, Invoice::getTotal, BigDecimal::add)));

        Map<UUID, BigDecimal> expenseByProject = expenseRepository
                .search(orgId, null, regionIds, Expense.STATUS_APPROVED, null, null, null, null, PageRequest.of(0, 5000))
                .getContent()
                .stream()
                .filter(exp -> Expense.STATUS_APPROVED.equals(exp.getStatus()))
                .filter(exp -> exp.getProjectId() != null)
                .collect(Collectors.groupingBy(
                        Expense::getProjectId,
                        Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)));

        List<ProjectProfitabilityRow> rows = new ArrayList<>();
        for (Project project : projects) {
            BigDecimal revenue = revenueByProject.getOrDefault(project.getId(), BigDecimal.ZERO);
            BigDecimal expenses = expenseByProject.getOrDefault(project.getId(), BigDecimal.ZERO);
            BigDecimal cost = canViewRates ? estimateProjectCost(orgId, project.getId()) : BigDecimal.ZERO;
            rows.add(new ProjectProfitabilityRow(
                    project.getId(),
                    project.getName(),
                    revenue,
                    cost,
                    expenses,
                    revenue.subtract(cost).subtract(expenses)));
        }
        return new ProjectProfitabilityReport(rows);
    }

    @Transactional(readOnly = true)
    public ResourceUtilizationReport resourceUtilization(ReportFilterRequest request) {
        tenantAccess.requirePermission("REPORT_VIEW");
        tenantAccess.requirePermission("ALLOCATION_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = scopedRegions(request == null ? null : request.regionId());
        LocalDate from = request == null || request.fromDate() == null ? LocalDate.now().withDayOfMonth(1) : request.fromDate();
        LocalDate to = request == null || request.toDate() == null ? LocalDate.now() : request.toDate();

        List<Resource> resources = resourceRepository
                .search(orgId, null, regionIds, null, null, null, null, PageRequest.of(0, 5000))
                .getContent();

        List<ResourceUtilizationRow> rows = new ArrayList<>();
        for (Resource resource : resources) {
            UtilizationResponse utilization = utilizationService.compute(resource, from, to, null, null);
            rows.add(new ResourceUtilizationRow(
                    resource.getId(),
                    resource.getEmployeeCode(),
                    resource.getDesignation(),
                    utilization.utilizationPercent(),
                    utilization.overAllocated()));
        }
        return new ResourceUtilizationReport(from, to, rows);
    }

    @Transactional(readOnly = true)
    public ProcurementSpendReport procurementSpend(ReportFilterRequest request) {
        tenantAccess.requirePermission("REPORT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = scopedRegions(request == null ? null : request.regionId());
        LocalDate from = request == null ? null : request.fromDate();
        LocalDate to = request == null ? null : request.toDate();

        List<PurchaseOrder> purchaseOrders = purchaseOrderRepository
                .search(orgId, null, regionIds, null, null, null, PageRequest.of(0, 5000))
                .getContent()
                .stream()
                .filter(po -> !PurchaseOrder.STATUS_DRAFT.equals(po.getStatus())
                        && !PurchaseOrder.STATUS_REJECTED.equals(po.getStatus()))
                .filter(po -> inDateRange(
                        po.getCreatedAt() == null
                                ? null
                                : po.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toLocalDate(),
                        from,
                        to))
                .toList();

        List<Expense> expenses = expenseRepository
                .search(orgId, null, regionIds, Expense.STATUS_APPROVED, null, null, null, null, PageRequest.of(0, 5000))
                .getContent()
                .stream()
                .filter(exp -> Expense.STATUS_APPROVED.equals(exp.getStatus()))
                .filter(exp -> inDateRange(exp.getExpenseDate(), from, to))
                .toList();

        Map<String, BigDecimal> expensesByCategory = new HashMap<>();
        BigDecimal expenseTotal = BigDecimal.ZERO;
        for (Expense expense : expenses) {
            expenseTotal = expenseTotal.add(expense.getAmount());
            expensesByCategory.merge(
                    expense.getCategory() == null ? "UNCATEGORIZED" : expense.getCategory(),
                    expense.getAmount(),
                    BigDecimal::add);
        }

        Map<String, BigDecimal> purchaseOrdersByStatus = new HashMap<>();
        BigDecimal purchaseOrderTotal = BigDecimal.ZERO;
        for (PurchaseOrder po : purchaseOrders) {
            purchaseOrderTotal = purchaseOrderTotal.add(po.getTotal() == null ? BigDecimal.ZERO : po.getTotal());
            purchaseOrdersByStatus.merge(po.getStatus(), po.getTotal(), BigDecimal::add);
        }

        return new ProcurementSpendReport(purchaseOrderTotal, expenseTotal, expensesByCategory, purchaseOrdersByStatus);
    }

    private BigDecimal estimateProjectCost(UUID organizationId, UUID projectId) {
        BigDecimal hours = BigDecimal.ZERO;
        List<Timesheet> timesheets = timesheetRepository
                .search(organizationId, Timesheet.STATUS_APPROVED, null, null, false, null, null, PageRequest.of(0, 5000))
                .getContent();
        for (Timesheet ts : timesheets) {
            for (TimeEntry entry : timeEntryRepository.findActiveByTimesheetId(ts.getId())) {
                if (projectId.equals(entry.getProjectId())) {
                    hours = hours.add(entry.getHours() == null ? BigDecimal.ZERO : entry.getHours());
                }
            }
        }
        return hours.multiply(BigDecimal.valueOf(1000));
    }

    private Collection<UUID> scopedRegions(UUID regionId) {
        if (regionId != null) {
            tenantAccess.assertRegionVisible(regionId);
            return List.of(regionId);
        }
        return tenantAccess.regionFilterOrNull();
    }

    private static boolean inDateRange(LocalDate value, LocalDate from, LocalDate to) {
        if (value == null) {
            return true;
        }
        if (from != null && value.isBefore(from)) {
            return false;
        }
        if (to != null && value.isAfter(to)) {
            return false;
        }
        return true;
    }
}
