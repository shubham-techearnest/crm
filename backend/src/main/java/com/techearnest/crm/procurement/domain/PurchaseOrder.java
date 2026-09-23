package com.techearnest.crm.procurement.domain;

import com.techearnest.crm.common.security.SecuredRecord;
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
@Table(name = "purchase_orders")
public class PurchaseOrder implements SecuredRecord {

    public static final String STATUS_DRAFT = "DRAFT";

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "requester_id")
    private UUID requesterId;

    @Column(name = "po_number", length = 64)
    private String poNumber;

    @Column(nullable = false, length = 32)
    private String status = STATUS_DRAFT;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode = "INR";

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "tax_total", nullable = false, precision = 18, scale = 2)
    private BigDecimal taxTotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "needed_by")
    private LocalDate neededBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_by")
    private UUID approvedBy;

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

    public static PurchaseOrder createDraft(
            UUID organizationId,
            UUID regionId,
            UUID vendorId,
            UUID projectId,
            UUID requesterId,
            String poNumber,
            String currencyCode,
            LocalDate neededBy,
            String notes,
            UUID createdBy) {
        PurchaseOrder po = new PurchaseOrder();
        po.id = UUID.randomUUID();
        po.organizationId = organizationId;
        po.regionId = regionId;
        po.vendorId = vendorId;
        po.projectId = projectId;
        po.requesterId = requesterId != null ? requesterId : createdBy;
        po.poNumber = blankToNull(poNumber);
        po.status = STATUS_DRAFT;
        po.currencyCode =
                currencyCode == null || currencyCode.isBlank() ? "INR" : currencyCode.trim().toUpperCase();
        po.neededBy = neededBy;
        po.notes = blankToNull(notes);
        po.createdAt = Instant.now();
        po.updatedAt = Instant.now();
        po.createdBy = createdBy;
        po.updatedBy = createdBy;
        return po;
    }

    public void update(
            UUID projectId,
            String poNumber,
            String currencyCode,
            LocalDate neededBy,
            String notes,
            UUID updatedBy) {
        if (projectId != null) {
            this.projectId = projectId;
        }
        if (poNumber != null) {
            this.poNumber = blankToNull(poNumber);
        }
        if (currencyCode != null && !currencyCode.isBlank()) {
            this.currencyCode = currencyCode.trim().toUpperCase();
        }
        if (neededBy != null) {
            this.neededBy = neededBy;
        }
        if (notes != null) {
            this.notes = blankToNull(notes);
        }
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }

    public void recalculateTotals(BigDecimal subtotal, BigDecimal taxTotal) {
        this.subtotal = money(subtotal);
        this.taxTotal = money(taxTotal);
        this.total = this.subtotal.add(this.taxTotal);
        this.updatedAt = Instant.now();
    }

    public boolean isDraft() {
        return STATUS_DRAFT.equals(status);
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    private static BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Override
    public UUID getOrganizationId() {
        return organizationId;
    }

    @Override
    public UUID getRegionId() {
        return regionId;
    }

    @Override
    public UUID getOwnerId() {
        return requesterId != null ? requesterId : createdBy;
    }

    public UUID getId() {
        return id;
    }

    public UUID getVendorId() {
        return vendorId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getRequesterId() {
        return requesterId;
    }

    public String getPoNumber() {
        return poNumber;
    }

    public String getStatus() {
        return status;
    }

    public String getCurrencyCode() {
        return currencyCode;
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

    public LocalDate getNeededBy() {
        return neededBy;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public UUID getApprovedBy() {
        return approvedBy;
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
}
