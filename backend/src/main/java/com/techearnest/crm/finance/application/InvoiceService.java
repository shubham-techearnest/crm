package com.techearnest.crm.finance.application;

import com.techearnest.crm.account.domain.Account;
import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.filter.FilterSpecificationBuilder;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.AddManualLineRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.CreateInvoiceRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.InvoiceResponse;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.IssueInvoiceRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.PullTimeEntriesRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.QueryInvoiceRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.RecordPaymentRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.UnbilledTimeEntryResponse;
import com.techearnest.crm.finance.domain.CreditNote;
import com.techearnest.crm.finance.domain.CreditNoteRepository;
import com.techearnest.crm.finance.domain.Invoice;
import com.techearnest.crm.finance.domain.InvoiceLine;
import com.techearnest.crm.finance.domain.InvoiceLineRepository;
import com.techearnest.crm.finance.domain.InvoiceNumberSequence;
import com.techearnest.crm.finance.domain.InvoiceNumberSequenceRepository;
import com.techearnest.crm.finance.domain.InvoicePayment;
import com.techearnest.crm.finance.domain.InvoicePaymentRepository;
import com.techearnest.crm.finance.domain.InvoiceRepository;
import com.techearnest.crm.finance.domain.TaxRate;
import com.techearnest.crm.finance.domain.TaxRateRepository;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.timesheet.domain.TimeEntry;
import com.techearnest.crm.timesheet.domain.TimeEntryRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceLineRepository invoiceLineRepository;
    private final InvoicePaymentRepository invoicePaymentRepository;
    private final CreditNoteRepository creditNoteRepository;
    private final InvoiceNumberSequenceRepository sequenceRepository;
    private final TaxRateRepository taxRateRepository;
    private final AccountRepository accountRepository;
    private final ProjectRepository projectRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public InvoiceService(
            InvoiceRepository invoiceRepository,
            InvoiceLineRepository invoiceLineRepository,
            InvoicePaymentRepository invoicePaymentRepository,
            CreditNoteRepository creditNoteRepository,
            InvoiceNumberSequenceRepository sequenceRepository,
            TaxRateRepository taxRateRepository,
            AccountRepository accountRepository,
            ProjectRepository projectRepository,
            TimeEntryRepository timeEntryRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.invoiceRepository = invoiceRepository;
        this.invoiceLineRepository = invoiceLineRepository;
        this.invoicePaymentRepository = invoicePaymentRepository;
        this.creditNoteRepository = creditNoteRepository;
        this.sequenceRepository = sequenceRepository;
        this.taxRateRepository = taxRateRepository;
        this.accountRepository = accountRepository;
        this.projectRepository = projectRepository;
        this.timeEntryRepository = timeEntryRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String search,
            String status,
            UUID accountId,
            UUID projectId,
            boolean overdueOnly,
            Pageable pageable) {
        tenantAccess.requirePermission("INVOICE_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Page<Invoice> page = invoiceRepository.search(
                orgId, blankToNull(search), regionIds, blankToNull(status), accountId, projectId, overdueOnly, pageable);
        refreshOverdue(page.getContent());
        return new PageResult(page.map(InvoiceResponse::summary).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public PageResult query(QueryInvoiceRequest request) {
        tenantAccess.requirePermission("INVOICE_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        int page = request != null && request.page() != null ? request.page() : 0;
        int size = request != null && request.size() != null ? Math.min(request.size(), 100) : 50;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Specification<Invoice> filterSpec = FilterSpecificationBuilder.build(
                request == null ? null : request.filter(), InvoiceFilterFields.ALLOWED);
        boolean overdueOnly = request != null && Boolean.TRUE.equals(request.overdueOnly());
        Page<Invoice> result = invoiceRepository.searchWithFilter(
                orgId,
                request == null ? null : blankToNull(request.search()),
                regionIds,
                request == null ? null : blankToNull(request.status()),
                request == null ? null : request.accountId(),
                request == null ? null : request.projectId(),
                overdueOnly,
                filterSpec,
                pageable);
        refreshOverdue(result.getContent());
        return new PageResult(result.map(InvoiceResponse::summary).getContent(), PaginationMeta.from(result));
    }

    @Transactional(readOnly = true)
    public InvoiceResponse get(UUID id) {
        tenantAccess.requirePermission("INVOICE_VIEW");
        Invoice invoice = requireVisible(id);
        invoice.refreshOverdue(LocalDate.now());
        return detail(invoice);
    }

    @Transactional
    public InvoiceResponse createDraft(CreateInvoiceRequest request) {
        CurrentUser user = tenantAccess.requirePermission("INVOICE_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        tenantAccess.assertRegionVisible(request.regionId());
        Account account = accountRepository
                .findActiveById(request.accountId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!orgId.equals(account.getOrganizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        UUID projectId = null;
        if (request.projectId() != null) {
            Project project = projectRepository
                    .findActiveById(request.projectId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            if (!orgId.equals(project.getOrganizationId())) {
                throw new ResourceNotFoundException("Resource not found");
            }
            if (!account.getId().equals(project.getAccountId())) {
                throw new BusinessException("ACCOUNT_MISMATCH", "Project does not belong to the selected account");
            }
            projectId = project.getId();
        }
        Invoice invoice = Invoice.createDraft(
                orgId,
                request.regionId(),
                account.getId(),
                projectId,
                request.currencyCode(),
                request.dueDate(),
                blankToNull(request.notes()),
                user.userId());
        invoiceRepository.save(invoice);
        auditService.record(orgId, user.userId(), "CREATE", "INVOICE", invoice.getId());
        return detail(invoice);
    }

    @Transactional
    public InvoiceResponse addManualLine(UUID invoiceId, AddManualLineRequest request) {
        CurrentUser user = tenantAccess.requirePermission("INVOICE_UPDATE");
        Invoice invoice = requireEditable(invoiceId);
        TaxRate tax = resolveTax(request.taxRateId(), invoice.getOrganizationId());
        int nextLine = invoiceLineRepository.findActiveByInvoiceId(invoiceId).size() + 1;
        BigDecimal qty = request.quantity();
        BigDecimal unit = request.unitPrice();
        BigDecimal amount = qty.multiply(unit);
        BigDecimal taxAmount = taxAmount(amount, tax);
        InvoiceLine line = InvoiceLine.create(
                invoice.getOrganizationId(),
                invoiceId,
                nextLine,
                request.description().trim(),
                qty,
                unit,
                tax == null ? null : tax.getId(),
                taxAmount,
                invoice.getProjectId(),
                null);
        invoiceLineRepository.save(line);
        recalculate(invoice);
        invoice.setUpdatedBy(user.userId());
        auditService.record(invoice.getOrganizationId(), user.userId(), "UPDATE", "INVOICE", invoice.getId());
        return detail(invoice);
    }

    @Transactional
    public InvoiceResponse pullTimeEntries(UUID invoiceId, PullTimeEntriesRequest request) {
        CurrentUser user = tenantAccess.requirePermission("INVOICE_UPDATE");
        Invoice invoice = requireEditable(invoiceId);
        if (request.timeEntryIds() == null || request.timeEntryIds().isEmpty()) {
            throw new BusinessException("NO_ENTRIES", "Select at least one time entry");
        }
        TaxRate tax = resolveTax(request.taxRateId(), invoice.getOrganizationId());
        int lineNo = invoiceLineRepository.findActiveByInvoiceId(invoiceId).size();
        for (UUID entryId : request.timeEntryIds()) {
            TimeEntry entry = timeEntryRepository
                    .findActiveById(entryId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            if (!invoice.getOrganizationId().equals(entry.getOrganizationId())) {
                throw new ResourceNotFoundException("Resource not found");
            }
            if (!entry.isBillable()) {
                throw new BusinessException("NOT_BILLABLE", "Time entry is not billable");
            }
            // approved check via unbilled query membership
            List<TimeEntry> unbilled = timeEntryRepository.findUnbilledApprovedBillable(
                    invoice.getOrganizationId(), invoice.getProjectId());
            boolean allowed = unbilled.stream().anyMatch(e -> e.getId().equals(entryId));
            if (!allowed) {
                throw new BusinessException(
                        "NOT_UNBILLED", "Time entry is not approved billable or already invoiced");
            }
            if (invoiceLineRepository.existsByTimeEntryIdAndDeletedAtIsNull(entryId)) {
                throw new ConflictException("Time entry already invoiced");
            }
            if (invoice.getProjectId() != null && !invoice.getProjectId().equals(entry.getProjectId())) {
                throw new BusinessException("PROJECT_MISMATCH", "Time entry project does not match invoice");
            }
            BigDecimal rate = entry.getBillingRate() == null ? BigDecimal.ZERO : entry.getBillingRate();
            BigDecimal amount = entry.getHours().multiply(rate);
            BigDecimal taxAmt = taxAmount(amount, tax);
            lineNo += 1;
            String desc = "Time " + entry.getWorkDate()
                    + (entry.getDescription() == null || entry.getDescription().isBlank()
                            ? ""
                            : " — " + entry.getDescription());
            invoiceLineRepository.save(InvoiceLine.create(
                    invoice.getOrganizationId(),
                    invoiceId,
                    lineNo,
                    desc,
                    entry.getHours(),
                    rate,
                    tax == null ? null : tax.getId(),
                    taxAmt,
                    entry.getProjectId(),
                    entry.getId()));
        }
        recalculate(invoice);
        invoice.setUpdatedBy(user.userId());
        auditService.record(invoice.getOrganizationId(), user.userId(), "UPDATE", "INVOICE", invoice.getId());
        return detail(invoice);
    }

    @Transactional(readOnly = true)
    public List<UnbilledTimeEntryResponse> listUnbilled(UUID projectId) {
        tenantAccess.requirePermission("INVOICE_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        return timeEntryRepository.findUnbilledApprovedBillable(orgId, projectId).stream()
                .map(UnbilledTimeEntryResponse::from)
                .toList();
    }

    @Transactional
    public InvoiceResponse issue(UUID id, IssueInvoiceRequest request) {
        CurrentUser user = tenantAccess.requirePermission("INVOICE_UPDATE");
        Invoice invoice = requireVisible(id);
        if (!invoice.isEditable()) {
            throw new BusinessException("INVALID_STATUS", "Only draft invoices can be issued");
        }
        List<InvoiceLine> lines = invoiceLineRepository.findActiveByInvoiceId(id);
        if (lines.isEmpty()) {
            throw new BusinessException("NO_LINES", "Add at least one line before issuing");
        }
        String number = nextInvoiceNumber(invoice.getOrganizationId());
        try {
            invoice.issue(
                    number,
                    request == null ? null : request.issueDate(),
                    request == null ? null : request.dueDate());
        } catch (IllegalStateException ex) {
            throw new BusinessException("INVALID_STATUS", ex.getMessage());
        }
        invoice.setUpdatedBy(user.userId());
        auditService.record(invoice.getOrganizationId(), user.userId(), "UPDATE", "INVOICE", invoice.getId());
        return detail(invoice);
    }

    @Transactional
    public InvoiceResponse voidInvoice(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("INVOICE_DELETE");
        Invoice invoice = requireVisible(id);
        try {
            invoice.voidInvoice();
        } catch (IllegalStateException ex) {
            throw new BusinessException("INVALID_STATUS", ex.getMessage());
        }
        invoice.setUpdatedBy(user.userId());
        auditService.record(invoice.getOrganizationId(), user.userId(), "DELETE", "INVOICE", invoice.getId());
        return detail(invoice);
    }

    @Transactional
    public InvoiceResponse recordPayment(UUID id, RecordPaymentRequest request) {
        CurrentUser user = tenantAccess.requirePermission("PAYMENT_MANAGE");
        Invoice invoice = requireVisible(id);
        if (request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("INVALID_AMOUNT", "Payment amount must be positive");
        }
        if (request.amount().compareTo(invoice.getBalanceDue()) > 0) {
            throw new BusinessException("OVERPAY", "Payment exceeds balance due");
        }
        try {
            invoice.applyPayment(request.amount());
        } catch (IllegalStateException ex) {
            throw new BusinessException("INVALID_STATUS", ex.getMessage());
        }
        invoicePaymentRepository.save(InvoicePayment.create(
                invoice.getOrganizationId(),
                invoice.getId(),
                request.amount(),
                request.paidAt(),
                blankToNull(request.method()),
                blankToNull(request.reference()),
                blankToNull(request.notes()),
                user.userId()));
        invoice.setUpdatedBy(user.userId());
        auditService.record(invoice.getOrganizationId(), user.userId(), "UPDATE", "INVOICE", invoice.getId());
        return detail(invoice);
    }

    @Transactional(readOnly = true)
    public String exportCsv(UUID organizationId) {
        tenantAccess.requirePermission("INVOICE_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Page<Invoice> page = invoiceRepository.search(
                orgId, null, regionIds, null, null, null, false, PageRequest.of(0, 5000, Sort.by("createdAt")));
        StringBuilder csv = new StringBuilder();
        csv.append(
                "id,invoiceNumber,status,accountId,projectId,issueDate,dueDate,total,amountPaid,amountCredited,balanceDue,currency\n");
        for (Invoice invoice : page.getContent()) {
            invoice.refreshOverdue(LocalDate.now());
            csv.append(invoice.getId())
                    .append(',')
                    .append(csvEsc(invoice.getInvoiceNumber()))
                    .append(',')
                    .append(csvEsc(invoice.getStatus()))
                    .append(',')
                    .append(invoice.getAccountId())
                    .append(',')
                    .append(invoice.getProjectId() == null ? "" : invoice.getProjectId())
                    .append(',')
                    .append(invoice.getIssueDate() == null ? "" : invoice.getIssueDate())
                    .append(',')
                    .append(invoice.getDueDate() == null ? "" : invoice.getDueDate())
                    .append(',')
                    .append(invoice.getTotal())
                    .append(',')
                    .append(invoice.getAmountPaid())
                    .append(',')
                    .append(invoice.getAmountCredited())
                    .append(',')
                    .append(invoice.getBalanceDue())
                    .append(',')
                    .append(csvEsc(invoice.getCurrencyCode()))
                    .append('\n');
        }
        return csv.toString();
    }

    private static String csvEsc(String value) {
        if (value == null) {
            return "";
        }
        String escaped = value.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\"") || escaped.contains("\n")) {
            return "\"" + escaped + "\"";
        }
        return escaped;
    }

    private String nextInvoiceNumber(UUID organizationId) {
        InvoiceNumberSequence seq = sequenceRepository
                .findForUpdate(organizationId, "INV")
                .orElseGet(() -> sequenceRepository.save(InvoiceNumberSequence.create(organizationId, "INV")));
        // re-lock if just created
        seq = sequenceRepository.findForUpdate(organizationId, "INV").orElse(seq);
        String number = seq.allocateNext();
        sequenceRepository.save(seq);
        return number;
    }

    private void recalculate(Invoice invoice) {
        List<InvoiceLine> lines = invoiceLineRepository.findActiveByInvoiceId(invoice.getId());
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal taxTotal = BigDecimal.ZERO;
        for (InvoiceLine line : lines) {
            subtotal = subtotal.add(line.getAmount());
            taxTotal = taxTotal.add(line.getTaxAmount());
        }
        invoice.recalculateTotals(subtotal, taxTotal);
    }

    private InvoiceResponse detail(Invoice invoice) {
        return InvoiceResponse.from(
                invoice,
                invoiceLineRepository.findActiveByInvoiceId(invoice.getId()),
                invoicePaymentRepository.findActiveByInvoiceId(invoice.getId()),
                creditNoteRepository.findActiveByInvoiceId(invoice.getId()));
    }

    private Invoice requireVisible(UUID id) {
        Invoice invoice =
                invoiceRepository.findActiveById(id).orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(invoice.getOrganizationId());
        tenantAccess.assertRegionVisible(invoice.getRegionId());
        return invoice;
    }

    private Invoice requireEditable(UUID id) {
        Invoice invoice = requireVisible(id);
        if (!invoice.isEditable()) {
            throw new BusinessException("IMMUTABLE", "Issued invoices cannot be edited");
        }
        return invoice;
    }

    private TaxRate resolveTax(UUID taxRateId, UUID organizationId) {
        if (taxRateId == null) {
            return null;
        }
        TaxRate tax = taxRateRepository
                .findActiveById(taxRateId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!organizationId.equals(tax.getOrganizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return tax;
    }

    private static BigDecimal taxAmount(BigDecimal amount, TaxRate tax) {
        if (tax == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return amount
                .multiply(tax.getRatePercent())
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
    }

    private void refreshOverdue(List<Invoice> invoices) {
        LocalDate today = LocalDate.now();
        for (Invoice invoice : invoices) {
            invoice.refreshOverdue(today);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<InvoiceResponse> data, PaginationMeta pagination) {}
}
