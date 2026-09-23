package com.techearnest.crm.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "invoices")
public class Invoice {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_ISSUED = "ISSUED";
    public static final String STATUS_PARTIALLY_PAID = "PARTIALLY_PAID";
    public static final String STATUS_PAID = "PAID";
    public static final String STATUS_VOID = "VOID";
    public static final String STATUS_OVERDUE = "OVERDUE";

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "invoice_number", length = 64)
    private String invoiceNumber;

    @Column(nullable = false, length = 32)
    private String status = STATUS_DRAFT;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode = "INR";

    @Column(name = "issue_date")
    private LocalDate issueDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "tax_total", nullable = false, precision = 18, scale = 2)
    private BigDecimal taxTotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "amount_paid", nullable = false, precision = 18, scale = 2)
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(name = "amount_credited", nullable = false, precision = 18, scale = 2)
    private BigDecimal amountCredited = BigDecimal.ZERO;

    @Column(name = "balance_due", nullable = false, precision = 18, scale = 2)
    private BigDecimal balanceDue = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String notes;

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

    public static Invoice createDraft(
            UUID organizationId,
            UUID regionId,
            UUID accountId,
            UUID projectId,
            String currencyCode,
            LocalDate dueDate,
            String notes,
            UUID createdBy) {
        Invoice invoice = new Invoice();
        invoice.id = UUID.randomUUID();
        invoice.organizationId = organizationId;
        invoice.regionId = regionId;
        invoice.accountId = accountId;
        invoice.projectId = projectId;
        invoice.status = STATUS_DRAFT;
        invoice.currencyCode = currencyCode == null || currencyCode.isBlank() ? "INR" : currencyCode.trim().toUpperCase();
        invoice.dueDate = dueDate;
        invoice.notes = notes;
        invoice.createdAt = Instant.now();
        invoice.updatedAt = Instant.now();
        invoice.createdBy = createdBy;
        invoice.updatedBy = createdBy;
        return invoice;
    }

    public void recalculateTotals(BigDecimal subtotal, BigDecimal taxTotal) {
        this.subtotal = money(subtotal);
        this.taxTotal = money(taxTotal);
        this.total = this.subtotal.add(this.taxTotal);
        recomputeBalance();
        this.updatedAt = Instant.now();
        refreshPaymentStatus();
    }

    public void issue(String invoiceNumber, LocalDate issueDate, LocalDate dueDate) {
        if (!STATUS_DRAFT.equals(status)) {
            throw new IllegalStateException("Only draft invoices can be issued");
        }
        this.invoiceNumber = invoiceNumber;
        this.issueDate = issueDate == null ? LocalDate.now() : issueDate;
        if (dueDate != null) {
            this.dueDate = dueDate;
        }
        this.status = STATUS_ISSUED;
        this.updatedAt = Instant.now();
        refreshOverdue(LocalDate.now());
    }

    public void voidInvoice() {
        if (STATUS_VOID.equals(status) || STATUS_PAID.equals(status)) {
            throw new IllegalStateException("Cannot void invoice in status " + status);
        }
        if (!STATUS_DRAFT.equals(status) && !STATUS_ISSUED.equals(status) && !STATUS_OVERDUE.equals(status)) {
            throw new IllegalStateException("Cannot void invoice in status " + status);
        }
        this.status = STATUS_VOID;
        this.updatedAt = Instant.now();
    }

    public void applyPayment(BigDecimal amount) {
        if (STATUS_VOID.equals(status) || STATUS_DRAFT.equals(status)) {
            throw new IllegalStateException("Cannot pay invoice in status " + status);
        }
        this.amountPaid = money(this.amountPaid.add(amount));
        recomputeBalance();
        this.updatedAt = Instant.now();
        refreshPaymentStatus();
    }

    public void applyCredit(BigDecimal amount) {
        if (STATUS_VOID.equals(status) || STATUS_DRAFT.equals(status)) {
            throw new IllegalStateException("Cannot credit invoice in status " + status);
        }
        if (amount.compareTo(balanceDue) > 0) {
            throw new IllegalStateException("Credit exceeds balance due");
        }
        this.amountCredited = money(this.amountCredited.add(amount));
        recomputeBalance();
        this.updatedAt = Instant.now();
        refreshPaymentStatus();
    }

    private void recomputeBalance() {
        this.balanceDue = this.total.subtract(this.amountPaid).subtract(this.amountCredited).max(BigDecimal.ZERO);
    }

    public void refreshOverdue(LocalDate today) {
        if (STATUS_ISSUED.equals(status) || STATUS_OVERDUE.equals(status) || STATUS_PARTIALLY_PAID.equals(status)) {
            if (dueDate != null && dueDate.isBefore(today) && balanceDue.compareTo(BigDecimal.ZERO) > 0) {
                if (!STATUS_PARTIALLY_PAID.equals(status)) {
                    this.status = STATUS_OVERDUE;
                }
            } else if (STATUS_OVERDUE.equals(status) && (dueDate == null || !dueDate.isBefore(today))) {
                this.status = amountPaid.compareTo(BigDecimal.ZERO) > 0 ? STATUS_PARTIALLY_PAID : STATUS_ISSUED;
            }
            this.updatedAt = Instant.now();
        }
    }

    private void refreshPaymentStatus() {
        if (STATUS_VOID.equals(status) || STATUS_DRAFT.equals(status)) {
            return;
        }
        if (balanceDue.compareTo(BigDecimal.ZERO) <= 0) {
            this.status = STATUS_PAID;
        } else if (amountPaid.add(amountCredited).compareTo(BigDecimal.ZERO) > 0) {
            this.status = STATUS_PARTIALLY_PAID;
            refreshOverdue(LocalDate.now());
        } else if (!STATUS_OVERDUE.equals(status)) {
            this.status = STATUS_ISSUED;
            refreshOverdue(LocalDate.now());
        }
    }

    public boolean isEditable() {
        return STATUS_DRAFT.equals(status);
    }

    private static BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getRegionId() {
        return regionId;
    }

    public UUID getAccountId() {
        return accountId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public String getStatus() {
        return status;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public LocalDate getIssueDate() {
        return issueDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public BigDecimal getTaxTotal() {
        return taxTotal;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public BigDecimal getAmountPaid() {
        return amountPaid;
    }

    public BigDecimal getAmountCredited() {
        return amountCredited;
    }

    public BigDecimal getBalanceDue() {
        return balanceDue;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void setNotes(String notes) {
        this.notes = notes;
        this.updatedAt = Instant.now();
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
        this.updatedAt = Instant.now();
    }

    public void setUpdatedBy(UUID updatedBy) {
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }
}
