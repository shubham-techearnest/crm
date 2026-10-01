package com.techearnest.crm.finance.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.InvoiceResponse;
import com.techearnest.crm.finance.api.dto.ProjectBillingDtos.ProjectInvoiceLine;
import com.techearnest.crm.finance.api.dto.ProjectBillingDtos.ProjectInvoicePreview;
import com.techearnest.crm.finance.api.dto.ProjectBillingDtos.ProjectInvoiceRequest;
import com.techearnest.crm.finance.domain.Invoice;
import com.techearnest.crm.finance.domain.InvoiceLine;
import com.techearnest.crm.finance.domain.InvoiceLineRepository;
import com.techearnest.crm.finance.domain.InvoiceRepository;
import com.techearnest.crm.finance.domain.TaxRate;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.resource.application.ResourceDisplayNames;
import com.techearnest.crm.timesheet.domain.TimeEntry;
import com.techearnest.crm.timesheet.domain.TimeEntryRepository;
import com.techearnest.crm.timesheet.domain.Timesheet;
import com.techearnest.crm.timesheet.domain.TimesheetRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Builds a draft invoice for a project from its billing type:
 * hourly types bill approved, not-yet-invoiced billable time in the period; fixed monthly bills one month's fee;
 * fixed bid bills an instalment of the remaining contract value.
 */
@Service
public class ProjectBillingService {

    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH);

    private final ProjectRepository projectRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceLineRepository invoiceLineRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final TimesheetRepository timesheetRepository;
    private final ResourceDisplayNames resourceNames;
    private final InvoiceService invoiceService;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public ProjectBillingService(
            ProjectRepository projectRepository,
            InvoiceRepository invoiceRepository,
            InvoiceLineRepository invoiceLineRepository,
            TimeEntryRepository timeEntryRepository,
            TimesheetRepository timesheetRepository,
            ResourceDisplayNames resourceNames,
            InvoiceService invoiceService,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.projectRepository = projectRepository;
        this.invoiceRepository = invoiceRepository;
        this.invoiceLineRepository = invoiceLineRepository;
        this.timeEntryRepository = timeEntryRepository;
        this.timesheetRepository = timesheetRepository;
        this.resourceNames = resourceNames;
        this.invoiceService = invoiceService;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public ProjectInvoicePreview preview(UUID projectId, ProjectInvoiceRequest request) {
        tenantAccess.requirePermission("INVOICE_VIEW");
        return build(requireProject(projectId), request == null ? emptyRequest() : request);
    }

    @Transactional
    public InvoiceResponse generate(UUID projectId, ProjectInvoiceRequest request) {
        CurrentUser user = tenantAccess.requirePermission("INVOICE_CREATE");
        Project project = requireProject(projectId);
        ProjectInvoiceRequest req = request == null ? emptyRequest() : request;
        ProjectInvoicePreview preview = build(project, req);
        if (preview.blockedReason() != null) {
            throw new BusinessException("NOTHING_TO_BILL", preview.blockedReason());
        }

        Invoice invoice = Invoice.createDraft(
                project.getOrganizationId(),
                project.getRegionId(),
                project.getAccountId(),
                project.getId(),
                null,
                req.dueDate(),
                "Generated from " + project.getProjectCode() + " (" + label(project.getBillingType()) + ")",
                user.userId());
        if (!Project.BILLING_FIXED_BID.equals(project.getBillingType())) {
            invoice.setBillingPeriod(preview.periodStart(), preview.periodEnd());
        }
        invoiceRepository.save(invoice);

        TaxRate tax = invoiceService.resolveTax(req.taxRateId(), project.getOrganizationId());
        int lineNo = 0;
        for (ProjectInvoiceLine line : preview.lines()) {
            lineNo += 1;
            invoiceLineRepository.save(InvoiceLine.create(
                    project.getOrganizationId(),
                    invoice.getId(),
                    lineNo,
                    line.description(),
                    line.quantity(),
                    line.unitPrice(),
                    tax == null ? null : tax.getId(),
                    InvoiceService.taxAmount(line.amount(), tax),
                    project.getId(),
                    line.timeEntryId()));
        }
        invoiceService.recalculate(invoice);
        auditService.record(project.getOrganizationId(), user.userId(), "CREATE", "INVOICE", invoice.getId());
        return invoiceService.detail(invoice);
    }

    private ProjectInvoicePreview build(Project project, ProjectInvoiceRequest req) {
        return switch (project.getBillingType()) {
            case Project.BILLING_NON_BILLABLE -> preview(project, null, null, List.of(), List.of(),
                    "Non-billable (in-house) projects are not invoiced.", null, null);
            case Project.BILLING_FIXED_MONTHLY -> monthly(project, req);
            case Project.BILLING_FIXED_BID -> fixedBid(project, req);
            default -> hourly(project, req);
        };
    }

    private ProjectInvoicePreview hourly(Project project, ProjectInvoiceRequest req) {
        LocalDate start = req.periodStart() != null ? req.periodStart() : YearMonth.now().atDay(1);
        LocalDate end = req.periodEnd() != null ? req.periodEnd() : YearMonth.from(start).atEndOfMonth();
        requireValidPeriod(start, end);
        boolean projectRate = Project.BILLING_TIME_AND_MATERIAL.equals(project.getBillingType());

        List<TimeEntry> entries = timeEntryRepository
                .findUnbilledApprovedBillable(project.getOrganizationId(), project.getId())
                .stream()
                .filter(entry -> !entry.getWorkDate().isBefore(start) && !entry.getWorkDate().isAfter(end))
                .toList();
        Map<UUID, String> nameByTimesheet = resourceNamesByTimesheet(entries);

        List<ProjectInvoiceLine> lines = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int unpriced = 0;
        for (TimeEntry entry : entries) {
            BigDecimal rate = projectRate
                    ? firstNonNull(project.getHourlyRate(), entry.getBillingRate())
                    : firstNonNull(entry.getBillingRate(), project.getHourlyRate());
            if (rate == null || rate.signum() == 0) {
                unpriced += 1;
                rate = BigDecimal.ZERO;
            }
            String who = nameByTimesheet.getOrDefault(entry.getTimesheetId(), "Resource");
            String description = who + " · " + entry.getWorkDate()
                    + (entry.getDescription() == null || entry.getDescription().isBlank()
                            ? ""
                            : " — " + entry.getDescription().trim());
            lines.add(line(truncate(description), entry.getHours(), rate, entry.getId()));
        }
        if (unpriced > 0) {
            warnings.add(unpriced + " time entr" + (unpriced == 1 ? "y has" : "ies have")
                    + " no billing rate; set the resource's billing rate"
                    + (projectRate ? "" : " or the project's fallback hourly rate") + ".");
        }
        String blocked = lines.isEmpty()
                ? "No approved, billable, un-invoiced hours between " + start + " and " + end + "."
                : null;
        return preview(project, start, end, lines, warnings, blocked, null, null);
    }

    private ProjectInvoicePreview monthly(Project project, ProjectInvoiceRequest req) {
        YearMonth month = YearMonth.from(req.periodStart() != null ? req.periodStart() : LocalDate.now());
        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();
        List<ProjectInvoiceLine> lines = new ArrayList<>();
        String blocked = null;
        if (project.getMonthlyFee() == null || project.getMonthlyFee().signum() == 0) {
            blocked = "Set the project's monthly fee before generating an invoice.";
        } else if (invoiceRepository.existsBilledPeriod(project.getId(), start)) {
            blocked = month.format(MONTH) + " has already been invoiced for this project.";
        } else {
            lines.add(line("Monthly fee — " + month.format(MONTH), BigDecimal.ONE, project.getMonthlyFee(), null));
        }
        return preview(project, start, end, lines, List.of(), blocked, null, null);
    }

    private ProjectInvoicePreview fixedBid(Project project, ProjectInvoiceRequest req) {
        BigDecimal contract = project.getContractValue() == null ? BigDecimal.ZERO : project.getContractValue();
        BigDecimal billed = money(invoiceRepository.sumBilledSubtotal(project.getId()));
        BigDecimal remaining = money(contract.subtract(billed).max(BigDecimal.ZERO));
        BigDecimal amount = money(req.amount() != null ? req.amount() : remaining);
        List<ProjectInvoiceLine> lines = new ArrayList<>();
        String blocked = null;
        if (contract.signum() == 0) {
            blocked = "Set the project's contract value before generating an invoice.";
        } else if (remaining.signum() == 0) {
            blocked = "The full contract value has already been invoiced.";
        } else if (amount.signum() == 0) {
            blocked = "Enter an amount to invoice.";
        } else if (amount.compareTo(remaining) > 0) {
            blocked = "Amount exceeds the remaining contract value of " + remaining + ".";
        } else {
            String description = req.description() != null && !req.description().isBlank()
                    ? req.description().trim()
                    : "Fixed bid instalment — " + percentOf(amount, contract) + "% of contract value";
            lines.add(line(truncate(description), BigDecimal.ONE, amount, null));
        }
        return preview(project, null, null, lines, List.of(), blocked, billed, remaining);
    }

    private ProjectInvoicePreview preview(
            Project project,
            LocalDate start,
            LocalDate end,
            List<ProjectInvoiceLine> lines,
            List<String> warnings,
            String blocked,
            BigDecimal billed,
            BigDecimal remaining) {
        BigDecimal subtotal = money(lines.stream().map(ProjectInvoiceLine::amount).reduce(BigDecimal.ZERO, BigDecimal::add));
        return new ProjectInvoicePreview(
                project.getId(),
                project.getBillingType(),
                start,
                end,
                lines,
                subtotal,
                project.getContractValue(),
                billed,
                remaining,
                warnings,
                blocked);
    }

    private Map<UUID, String> resourceNamesByTimesheet(List<TimeEntry> entries) {
        Set<UUID> timesheetIds = new HashSet<>();
        entries.forEach(entry -> timesheetIds.add(entry.getTimesheetId()));
        if (timesheetIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, UUID> resourceByTimesheet = new HashMap<>();
        for (Timesheet timesheet : timesheetRepository.findAllById(timesheetIds)) {
            resourceByTimesheet.put(timesheet.getId(), timesheet.getResourceId());
        }
        Map<UUID, String> names = resourceNames.byResourceIds(resourceByTimesheet.values());
        Map<UUID, String> result = new HashMap<>();
        resourceByTimesheet.forEach((timesheetId, resourceId) -> result.put(timesheetId, names.get(resourceId)));
        return result;
    }

    private Project requireProject(UUID projectId) {
        Project project = projectRepository
                .findActiveById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(project.getOrganizationId());
        tenantAccess.assertRegionVisible(project.getRegionId());
        return project;
    }

    private static void requireValidPeriod(LocalDate start, LocalDate end) {
        if (end.isBefore(start)) {
            throw new BusinessException("INVALID_PERIOD", "Period end cannot be before period start");
        }
    }

    private static ProjectInvoiceLine line(String description, BigDecimal quantity, BigDecimal unitPrice, UUID timeEntryId) {
        return new ProjectInvoiceLine(description, quantity, money(unitPrice), money(quantity.multiply(unitPrice)), timeEntryId);
    }

    private static BigDecimal firstNonNull(BigDecimal first, BigDecimal second) {
        return first != null && first.signum() > 0 ? first : second;
    }

    private static BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private static String percentOf(BigDecimal part, BigDecimal whole) {
        return part.multiply(new BigDecimal("100")).divide(whole, 1, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private static String truncate(String value) {
        return value.length() <= 500 ? value : value.substring(0, 497) + "...";
    }

    private static String label(String billingType) {
        return switch (billingType) {
            case Project.BILLING_STAFF_AUGMENTATION -> "Staff augmentation";
            case Project.BILLING_TIME_AND_MATERIAL -> "Time & material";
            case Project.BILLING_FIXED_MONTHLY -> "Fixed monthly";
            case Project.BILLING_FIXED_BID -> "Fixed bid";
            case Project.BILLING_NON_BILLABLE -> "Non-billable";
            default -> billingType;
        };
    }

    private static ProjectInvoiceRequest emptyRequest() {
        return new ProjectInvoiceRequest(null, null, null, null, null, null);
    }
}
