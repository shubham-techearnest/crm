package com.techearnest.crm.portal.application;

import com.techearnest.crm.document.domain.Document;
import com.techearnest.crm.document.domain.DocumentRepository;
import com.techearnest.crm.finance.domain.Invoice;
import com.techearnest.crm.finance.domain.InvoiceRepository;
import com.techearnest.crm.portal.application.PortalAuthService.PortalSession;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortalReadService {

    private final PortalAuthService portalAuthService;
    private final ProjectRepository projectRepository;
    private final InvoiceRepository invoiceRepository;
    private final DocumentRepository documentRepository;

    public PortalReadService(
            PortalAuthService portalAuthService,
            ProjectRepository projectRepository,
            InvoiceRepository invoiceRepository,
            DocumentRepository documentRepository) {
        this.portalAuthService = portalAuthService;
        this.projectRepository = projectRepository;
        this.invoiceRepository = invoiceRepository;
        this.documentRepository = documentRepository;
    }

    @Transactional(readOnly = true)
    public List<PortalProjectSummary> listProjects() {
        PortalSession session = portalAuthService.requirePortalSession();
        return projectRepository
                .search(
                        session.organizationId(),
                        null,
                        null,
                        null,
                        null,
                        session.accountId(),
                        null,
                        null,
                        null,
                        false,
                        PageRequest.of(0, 100))
                .map(PortalProjectSummary::from)
                .getContent();
    }

    @Transactional(readOnly = true)
    public List<PortalInvoiceSummary> listInvoices() {
        PortalSession session = portalAuthService.requirePortalSession();
        return invoiceRepository
                .search(session.organizationId(), null, null, null, session.accountId(), null, false, PageRequest.of(0, 100))
                .map(PortalInvoiceSummary::from)
                .getContent();
    }

    @Transactional(readOnly = true)
    public List<PortalDocumentSummary> listDocuments() {
        PortalSession session = portalAuthService.requirePortalSession();
        return documentRepository
                .searchRecent(session.organizationId(), null, "CUSTOMER", null, null, null, PageRequest.of(0, 100))
                .stream()
                .filter(doc -> isAccountScoped(doc, session))
                .map(PortalDocumentSummary::from)
                .toList();
    }

    private boolean isAccountScoped(Document doc, PortalSession session) {
        if ("ACCOUNT".equalsIgnoreCase(doc.getEntityType()) && session.accountId().equals(doc.getEntityId())) {
            return true;
        }
        if ("INVOICE".equalsIgnoreCase(doc.getEntityType())) {
            return invoiceRepository
                    .findActiveById(doc.getEntityId())
                    .map(inv -> session.accountId().equals(inv.getAccountId()))
                    .orElse(false);
        }
        if ("PROJECT".equalsIgnoreCase(doc.getEntityType())) {
            return projectRepository
                    .findActiveById(doc.getEntityId())
                    .map(p -> session.accountId().equals(p.getAccountId()))
                    .orElse(false);
        }
        return false;
    }

    public record PortalProjectSummary(UUID id, String name, String status, LocalDate endDate) {
        static PortalProjectSummary from(Project project) {
            return new PortalProjectSummary(project.getId(), project.getName(), project.getStatus(), project.getEndDate());
        }
    }

    public record PortalInvoiceSummary(
            UUID id, String invoiceNumber, String status, BigDecimal total, BigDecimal balanceDue, LocalDate dueDate) {
        static PortalInvoiceSummary from(Invoice invoice) {
            return new PortalInvoiceSummary(
                    invoice.getId(),
                    invoice.getInvoiceNumber(),
                    invoice.getStatus(),
                    invoice.getTotal(),
                    invoice.getBalanceDue(),
                    invoice.getDueDate());
        }
    }

    public record PortalDocumentSummary(UUID id, String fileName, String entityType, UUID entityId) {
        static PortalDocumentSummary from(Document doc) {
            return new PortalDocumentSummary(doc.getId(), doc.getFileName(), doc.getEntityType(), doc.getEntityId());
        }
    }
}
