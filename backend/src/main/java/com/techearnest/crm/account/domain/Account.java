package com.techearnest.crm.account.domain;

import com.techearnest.crm.common.security.SecuredRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.domain.Persistable;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "accounts")
@EntityListeners(AuditingEntityListener.class)
public class Account implements SecuredRecord, Persistable<UUID> {

    @Id
    private UUID id;

    @Transient
    private boolean newEntity = true;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private String name;

    private String industry;
    private String website;
    private String email;
    private String phone;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "billing_address", columnDefinition = "jsonb")
    private String billingAddress;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "shipping_address", columnDefinition = "jsonb")
    private String shippingAddress;

    @Column(name = "tax_number")
    private String taxNumber;

    @Column(nullable = false)
    private String status;

    @Column(name = "account_type", nullable = false)
    private String accountType;

    private String description;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private UUID updatedBy;

    public static Account create(
            UUID organizationId,
            UUID regionId,
            UUID ownerId,
            String name,
            String industry,
            String website,
            String email,
            String phone,
            String billingAddress,
            String shippingAddress,
            String taxNumber,
            String status,
            String accountType,
            String description) {
        Account account = new Account();
        account.id = UUID.randomUUID();
        account.organizationId = organizationId;
        account.regionId = regionId;
        account.ownerId = ownerId;
        account.name = name;
        account.industry = industry;
        account.website = website;
        account.email = email;
        account.phone = phone;
        account.billingAddress = billingAddress;
        account.shippingAddress = shippingAddress;
        account.taxNumber = taxNumber;
        account.status = status != null && !status.isBlank() ? status : "ACTIVE";
        account.accountType = accountType;
        account.description = description;
        return account;
    }

    public void update(
            UUID regionId,
            UUID ownerId,
            String name,
            String industry,
            String website,
            String email,
            String phone,
            String billingAddress,
            String shippingAddress,
            String taxNumber,
            String status,
            String accountType,
            String description) {
        if (regionId != null) {
            this.regionId = regionId;
        }
        if (ownerId != null) {
            this.ownerId = ownerId;
        }
        // Partial PATCH: null means leave unchanged.
        if (name != null) {
            this.name = name;
        }
        if (industry != null) {
            this.industry = industry;
        }
        if (website != null) {
            this.website = website;
        }
        if (email != null) {
            this.email = email;
        }
        if (phone != null) {
            this.phone = phone;
        }
        if (billingAddress != null) {
            this.billingAddress = billingAddress;
        }
        if (shippingAddress != null) {
            this.shippingAddress = shippingAddress;
        }
        if (taxNumber != null) {
            this.taxNumber = taxNumber;
        }
        if (status != null && !status.isBlank()) {
            this.status = status;
        }
        if (accountType != null && !accountType.isBlank()) {
            this.accountType = accountType;
        }
        if (description != null) {
            this.description = description;
        }
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.status = "INACTIVE";
    }

    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.newEntity = false;
    }

    @Override
    public UUID getId() {
        return id;
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
        return ownerId;
    }

    public String getName() {
        return name;
    }

    public String getIndustry() {
        return industry;
    }

    public String getWebsite() {
        return website;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public String getBillingAddress() {
        return billingAddress;
    }

    public String getShippingAddress() {
        return shippingAddress;
    }

    public String getTaxNumber() {
        return taxNumber;
    }

    public String getStatus() {
        return status;
    }

    public String getAccountType() {
        return accountType;
    }

    public String getDescription() {
        return description;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public Long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
