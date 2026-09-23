package com.techearnest.crm.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "invoice_lines")
public class InvoiceLine {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "invoice_id", nullable = false)
    private UUID invoiceId;

    @Column(name = "line_no", nullable = false)
    private int lineNo;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal quantity = BigDecimal.ONE;

    @Column(name = "unit_price", nullable = false, precision = 18, scale = 2)
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(name = "tax_rate_id")
    private UUID taxRateId;

    @Column(name = "tax_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "time_entry_id")
    private UUID timeEntryId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static InvoiceLine create(
            UUID organizationId,
            UUID invoiceId,
            int lineNo,
            String description,
            BigDecimal quantity,
            BigDecimal unitPrice,
            UUID taxRateId,
            BigDecimal taxAmount,
            UUID projectId,
            UUID timeEntryId) {
        InvoiceLine line = new InvoiceLine();
        line.id = UUID.randomUUID();
        line.organizationId = organizationId;
        line.invoiceId = invoiceId;
        line.lineNo = lineNo;
        line.description = description;
        line.quantity = money(quantity, 2);
        line.unitPrice = money(unitPrice, 2);
        line.amount = money(line.quantity.multiply(line.unitPrice), 2);
        line.taxRateId = taxRateId;
        line.taxAmount = money(taxAmount, 2);
        line.projectId = projectId;
        line.timeEntryId = timeEntryId;
        line.createdAt = Instant.now();
        line.updatedAt = Instant.now();
        return line;
    }

    private static BigDecimal money(BigDecimal value, int scale) {
        return (value == null ? BigDecimal.ZERO : value).setScale(scale, RoundingMode.HALF_UP);
    }

    public UUID getId() {
        return id;
    }

    public UUID getInvoiceId() {
        return invoiceId;
    }

    public int getLineNo() {
        return lineNo;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public UUID getTaxRateId() {
        return taxRateId;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getTimeEntryId() {
        return timeEntryId;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
