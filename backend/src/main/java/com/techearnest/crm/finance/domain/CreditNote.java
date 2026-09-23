package com.techearnest.crm.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "credit_notes")
public class CreditNote {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_ISSUED = "ISSUED";
    public static final String STATUS_APPLIED = "APPLIED";
    public static final String STATUS_VOID = "VOID";

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "invoice_id", nullable = false)
    private UUID invoiceId;

    @Column(name = "credit_number", length = 64)
    private String creditNumber;

    @Column(nullable = false, length = 32)
    private String status = STATUS_DRAFT;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "issue_date")
    private LocalDate issueDate;

    @Column(name = "applied_at")
    private Instant appliedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static CreditNote create(
            UUID organizationId, UUID invoiceId, BigDecimal amount, String reason, UUID createdBy) {
        CreditNote note = new CreditNote();
        note.id = UUID.randomUUID();
        note.organizationId = organizationId;
        note.invoiceId = invoiceId;
        note.status = STATUS_DRAFT;
        note.amount = amount;
        note.reason = reason;
        note.createdAt = Instant.now();
        note.updatedAt = Instant.now();
        note.createdBy = createdBy;
        note.updatedBy = createdBy;
        return note;
    }

    public void issue(String creditNumber) {
        if (!STATUS_DRAFT.equals(status)) {
            throw new IllegalStateException("Only draft credit notes can be issued");
        }
        this.creditNumber = creditNumber;
        this.issueDate = LocalDate.now();
        this.status = STATUS_ISSUED;
        this.updatedAt = Instant.now();
    }

    public void markApplied() {
        if (!STATUS_ISSUED.equals(status)) {
            throw new IllegalStateException("Only issued credit notes can be applied");
        }
        this.status = STATUS_APPLIED;
        this.appliedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getInvoiceId() {
        return invoiceId;
    }

    public String getCreditNumber() {
        return creditNumber;
    }

    public String getStatus() {
        return status;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getReason() {
        return reason;
    }

    public LocalDate getIssueDate() {
        return issueDate;
    }

    public Instant getAppliedAt() {
        return appliedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedBy(UUID updatedBy) {
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }
}
