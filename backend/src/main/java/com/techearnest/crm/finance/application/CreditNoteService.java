package com.techearnest.crm.finance.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.finance.api.dto.CreditNoteDtos.CreateCreditNoteRequest;
import com.techearnest.crm.finance.api.dto.CreditNoteDtos.CreditNoteResponse;
import com.techearnest.crm.finance.domain.CreditNote;
import com.techearnest.crm.finance.domain.CreditNoteRepository;
import com.techearnest.crm.finance.domain.Invoice;
import com.techearnest.crm.finance.domain.InvoiceNumberSequence;
import com.techearnest.crm.finance.domain.InvoiceNumberSequenceRepository;
import com.techearnest.crm.finance.domain.InvoiceRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CreditNoteService {

    private final CreditNoteRepository creditNoteRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceNumberSequenceRepository sequenceRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public CreditNoteService(
            CreditNoteRepository creditNoteRepository,
            InvoiceRepository invoiceRepository,
            InvoiceNumberSequenceRepository sequenceRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.creditNoteRepository = creditNoteRepository;
        this.invoiceRepository = invoiceRepository;
        this.sequenceRepository = sequenceRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<CreditNoteResponse> listForInvoice(UUID invoiceId) {
        tenantAccess.requirePermission("INVOICE_VIEW");
        Invoice invoice = requireInvoice(invoiceId);
        return creditNoteRepository.findActiveByInvoiceId(invoice.getId()).stream()
                .map(CreditNoteResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CreditNoteResponse get(UUID id) {
        tenantAccess.requirePermission("INVOICE_VIEW");
        return CreditNoteResponse.from(requireVisible(id));
    }

    @Transactional
    public CreditNoteResponse create(UUID invoiceId, CreateCreditNoteRequest request) {
        CurrentUser user = requireCreditManage();
        Invoice invoice = requireInvoice(invoiceId);
        if (Invoice.STATUS_DRAFT.equals(invoice.getStatus()) || Invoice.STATUS_VOID.equals(invoice.getStatus())) {
            throw new BusinessException("INVALID_STATUS", "Cannot credit draft or void invoices");
        }
        if (request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("INVALID_AMOUNT", "Credit amount must be positive");
        }
        if (request.amount().compareTo(invoice.getBalanceDue()) > 0) {
            throw new BusinessException("OVER_CREDIT", "Credit exceeds balance due");
        }
        CreditNote note = CreditNote.create(
                invoice.getOrganizationId(),
                invoice.getId(),
                request.amount(),
                blankToNull(request.reason()),
                user.userId());
        creditNoteRepository.save(note);
        auditService.record(invoice.getOrganizationId(), user.userId(), "CREATE", "CREDIT_NOTE", note.getId());
        return CreditNoteResponse.from(note);
    }

    @Transactional
    public CreditNoteResponse issue(UUID id) {
        CurrentUser user = requireCreditManage();
        CreditNote note = requireVisible(id);
        try {
            note.issue(nextCreditNumber(note.getOrganizationId()));
        } catch (IllegalStateException ex) {
            throw new BusinessException("INVALID_STATUS", ex.getMessage());
        }
        note.setUpdatedBy(user.userId());
        auditService.record(note.getOrganizationId(), user.userId(), "UPDATE", "CREDIT_NOTE", note.getId());
        return CreditNoteResponse.from(note);
    }

    @Transactional
    public CreditNoteResponse apply(UUID id) {
        CurrentUser user = requireCreditManage();
        CreditNote note = requireVisible(id);
        Invoice invoice = requireInvoice(note.getInvoiceId());
        if (!CreditNote.STATUS_ISSUED.equals(note.getStatus())) {
            if (CreditNote.STATUS_DRAFT.equals(note.getStatus())) {
                note.issue(nextCreditNumber(note.getOrganizationId()));
            } else {
                throw new BusinessException("INVALID_STATUS", "Credit note cannot be applied");
            }
        }
        try {
            invoice.applyCredit(note.getAmount());
            note.markApplied();
        } catch (IllegalStateException ex) {
            throw new BusinessException("INVALID_STATUS", ex.getMessage());
        }
        note.setUpdatedBy(user.userId());
        invoice.setUpdatedBy(user.userId());
        auditService.record(note.getOrganizationId(), user.userId(), "UPDATE", "CREDIT_NOTE", note.getId());
        auditService.record(invoice.getOrganizationId(), user.userId(), "UPDATE", "INVOICE", invoice.getId());
        return CreditNoteResponse.from(note);
    }

    private String nextCreditNumber(UUID organizationId) {
        InvoiceNumberSequence seq = sequenceRepository
                .findForUpdate(organizationId, "CN")
                .orElseGet(() -> sequenceRepository.save(InvoiceNumberSequence.create(organizationId, "CN")));
        seq = sequenceRepository.findForUpdate(organizationId, "CN").orElse(seq);
        String number = seq.allocateNext();
        sequenceRepository.save(seq);
        return number;
    }

    private CreditNote requireVisible(UUID id) {
        CreditNote note =
                creditNoteRepository.findActiveById(id).orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(note.getOrganizationId());
        return note;
    }

    private Invoice requireInvoice(UUID id) {
        Invoice invoice =
                invoiceRepository.findActiveById(id).orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(invoice.getOrganizationId());
        return invoice;
    }

    private CurrentUser requireCreditManage() {
        CurrentUser user = tenantAccess.currentUser();
        if (user.hasPermission("CREDIT_NOTE_MANAGE") || user.hasPermission("INVOICE_UPDATE")) {
            return user;
        }
        throw new com.techearnest.crm.common.exception.ForbiddenException(
                "You do not have permission to perform this action");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
