package com.techearnest.crm.procurement.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "purchase_order_items")
public class PurchaseOrderItem {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "purchase_order_id", nullable = false)
    private UUID purchaseOrderId;

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

    @Column(name = "received_qty", nullable = false, precision = 12, scale = 2)
    private BigDecimal receivedQty = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static PurchaseOrderItem create(
            UUID organizationId,
            UUID purchaseOrderId,
            int lineNo,
            String description,
            BigDecimal quantity,
            BigDecimal unitPrice,
            UUID taxRateId,
            BigDecimal taxAmount) {
        PurchaseOrderItem item = new PurchaseOrderItem();
        item.id = UUID.randomUUID();
        item.organizationId = organizationId;
        item.purchaseOrderId = purchaseOrderId;
        item.lineNo = lineNo;
        item.description = description;
        item.quantity = money(quantity, 2);
        item.unitPrice = money(unitPrice, 2);
        item.amount = money(item.quantity.multiply(item.unitPrice), 2);
        item.taxRateId = taxRateId;
        item.taxAmount = money(taxAmount, 2);
        item.receivedQty = BigDecimal.ZERO;
        item.createdAt = Instant.now();
        item.updatedAt = Instant.now();
        return item;
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    private static BigDecimal money(BigDecimal value, int scale) {
        return (value == null ? BigDecimal.ZERO : value).setScale(scale, RoundingMode.HALF_UP);
    }

    public UUID getId() {
        return id;
    }

    public UUID getPurchaseOrderId() {
        return purchaseOrderId;
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

    public BigDecimal getReceivedQty() {
        return receivedQty;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
