package com.techearnest.crm.procurement.domain;

import com.techearnest.crm.common.security.SecuredRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "vendors")
public class Vendor implements SecuredRecord {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_INACTIVE = "INACTIVE";

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(nullable = false)
    private String name;

    @Column(length = 255)
    private String email;

    @Column(length = 64)
    private String phone;

    @Column(name = "tax_number", length = 64)
    private String taxNumber;

    @Column(name = "account_id")
    private UUID accountId;

    @Column(name = "payment_terms_days")
    private Integer paymentTermsDays;

    @Column(nullable = false, length = 32)
    private String status = STATUS_ACTIVE;

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

    public static Vendor create(
            UUID organizationId,
            UUID regionId,
            String name,
            String email,
            String phone,
            String taxNumber,
            UUID accountId,
            Integer paymentTermsDays,
            String status,
            String notes,
            UUID createdBy) {
        Vendor vendor = new Vendor();
        vendor.id = UUID.randomUUID();
        vendor.organizationId = organizationId;
        vendor.regionId = regionId;
        vendor.name = name.trim();
        vendor.email = blankToNull(email);
        vendor.phone = blankToNull(phone);
        vendor.taxNumber = blankToNull(taxNumber);
        vendor.accountId = accountId;
        vendor.paymentTermsDays = paymentTermsDays;
        vendor.status = status == null || status.isBlank() ? STATUS_ACTIVE : status.trim().toUpperCase();
        vendor.notes = blankToNull(notes);
        vendor.createdAt = Instant.now();
        vendor.updatedAt = Instant.now();
        vendor.createdBy = createdBy;
        vendor.updatedBy = createdBy;
        return vendor;
    }

    public void update(
            String name,
            String email,
            String phone,
            String taxNumber,
            UUID accountId,
            Integer paymentTermsDays,
            String status,
            String notes,
            UUID updatedBy) {
        if (name != null && !name.isBlank()) {
            this.name = name.trim();
        }
        if (email != null) {
            this.email = blankToNull(email);
        }
        if (phone != null) {
            this.phone = blankToNull(phone);
        }
        if (taxNumber != null) {
            this.taxNumber = blankToNull(taxNumber);
        }
        if (accountId != null) {
            this.accountId = accountId;
        }
        if (paymentTermsDays != null) {
            this.paymentTermsDays = paymentTermsDays;
        }
        if (status != null && !status.isBlank()) {
            this.status = status.trim().toUpperCase();
        }
        if (notes != null) {
            this.notes = blankToNull(notes);
        }
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.updatedAt = Instant.now();
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
        return createdBy;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public String getTaxNumber() {
        return taxNumber;
    }

    public UUID getAccountId() {
        return accountId;
    }

    public Integer getPaymentTermsDays() {
        return paymentTermsDays;
    }

    public String getStatus() {
        return status;
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
