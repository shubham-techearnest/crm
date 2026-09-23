package com.techearnest.crm.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tax_rates")
public class TaxRate {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(nullable = false, length = 32)
    private String code;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(name = "rate_percent", nullable = false, precision = 8, scale = 4)
    private BigDecimal ratePercent;

    @Column(length = 64)
    private String jurisdiction;

    @Column(name = "tax_type", nullable = false, length = 16)
    private String taxType = "OTHER";

    @Column(nullable = false)
    private boolean active = true;

    @Column(columnDefinition = "TEXT")
    private String description;

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

    public static TaxRate create(
            UUID organizationId,
            String code,
            String name,
            BigDecimal ratePercent,
            String jurisdiction,
            String taxType,
            String description,
            UUID createdBy) {
        TaxRate rate = new TaxRate();
        rate.id = UUID.randomUUID();
        rate.organizationId = organizationId;
        rate.code = code;
        rate.name = name;
        rate.ratePercent = ratePercent;
        rate.jurisdiction = jurisdiction;
        rate.taxType = taxType == null || taxType.isBlank() ? "OTHER" : taxType;
        rate.active = true;
        rate.description = description;
        rate.createdAt = Instant.now();
        rate.updatedAt = Instant.now();
        rate.createdBy = createdBy;
        rate.updatedBy = createdBy;
        return rate;
    }

    public void update(
            String name,
            BigDecimal ratePercent,
            String jurisdiction,
            String taxType,
            Boolean active,
            String description,
            UUID updatedBy) {
        if (name != null && !name.isBlank()) {
            this.name = name.trim();
        }
        if (ratePercent != null) {
            this.ratePercent = ratePercent;
        }
        if (jurisdiction != null) {
            this.jurisdiction = jurisdiction.isBlank() ? null : jurisdiction.trim();
        }
        if (taxType != null && !taxType.isBlank()) {
            this.taxType = taxType.trim();
        }
        if (active != null) {
            this.active = active;
        }
        if (description != null) {
            this.description = description.isBlank() ? null : description.trim();
        }
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.active = false;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getRatePercent() {
        return ratePercent;
    }

    public String getJurisdiction() {
        return jurisdiction;
    }

    public String getTaxType() {
        return taxType;
    }

    public boolean isActive() {
        return active;
    }

    public String getDescription() {
        return description;
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
