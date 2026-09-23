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
@Table(name = "invoice_payments")
public class InvoicePayment {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "invoice_id", nullable = false)
    private UUID invoiceId;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(name = "paid_at", nullable = false)
    private LocalDate paidAt;

    @Column(length = 32)
    private String method;

    @Column(length = 128)
    private String reference;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static InvoicePayment create(
            UUID organizationId,
            UUID invoiceId,
            BigDecimal amount,
            LocalDate paidAt,
            String method,
            String reference,
            String notes,
            UUID createdBy) {
        InvoicePayment payment = new InvoicePayment();
        payment.id = UUID.randomUUID();
        payment.organizationId = organizationId;
        payment.invoiceId = invoiceId;
        payment.amount = amount;
        payment.paidAt = paidAt == null ? LocalDate.now() : paidAt;
        payment.method = method;
        payment.reference = reference;
        payment.notes = notes;
        payment.createdAt = Instant.now();
        payment.createdBy = createdBy;
        return payment;
    }

    public UUID getId() {
        return id;
    }

    public UUID getInvoiceId() {
        return invoiceId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public LocalDate getPaidAt() {
        return paidAt;
    }

    public String getMethod() {
        return method;
    }

    public String getReference() {
        return reference;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
