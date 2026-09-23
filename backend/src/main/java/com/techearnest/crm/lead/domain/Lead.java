package com.techearnest.crm.lead.domain;

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
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.domain.Persistable;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "leads")
@EntityListeners(AuditingEntityListener.class)
public class Lead implements SecuredRecord, Persistable<UUID> {

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

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "company_name")
    private String companyName;

    private String email;
    private String phone;
    private String website;
    private String source;

    @Column(nullable = false)
    private String status;

    private String priority;
    private String industry;
    private String designation;

    @Column(name = "estimated_value")
    private BigDecimal estimatedValue;

    @Column(name = "expected_close_date")
    private LocalDate expectedCloseDate;

    private String description;

    @Column(name = "converted_account_id")
    private UUID convertedAccountId;

    @Column(name = "converted_contact_id")
    private UUID convertedContactId;

    @Column(name = "converted_deal_id")
    private UUID convertedDealId;

    @Column(name = "converted_at")
    private Instant convertedAt;

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

    public static Lead create(
            UUID organizationId,
            UUID regionId,
            UUID ownerId,
            String firstName,
            String lastName,
            String companyName,
            String email,
            String phone,
            String website,
            String source,
            String status,
            String priority,
            String industry,
            String designation,
            BigDecimal estimatedValue,
            LocalDate expectedCloseDate,
            String description) {
        Lead lead = new Lead();
        lead.id = UUID.randomUUID();
        lead.organizationId = organizationId;
        lead.regionId = regionId;
        lead.ownerId = ownerId;
        lead.firstName = firstName;
        lead.lastName = lastName;
        lead.companyName = companyName;
        lead.email = email;
        lead.phone = phone;
        lead.website = website;
        lead.source = source;
        lead.status = status != null && !status.isBlank() ? status : "NEW";
        lead.priority = priority;
        lead.industry = industry;
        lead.designation = designation;
        lead.estimatedValue = estimatedValue;
        lead.expectedCloseDate = expectedCloseDate;
        lead.description = description;
        return lead;
    }

    public void update(
            UUID regionId,
            UUID ownerId,
            String firstName,
            String lastName,
            String companyName,
            String email,
            String phone,
            String website,
            String source,
            String status,
            String priority,
            String industry,
            String designation,
            BigDecimal estimatedValue,
            LocalDate expectedCloseDate,
            String description) {
        if (regionId != null) {
            this.regionId = regionId;
        }
        if (ownerId != null) {
            this.ownerId = ownerId;
        }
        this.firstName = firstName;
        this.lastName = lastName;
        this.companyName = companyName;
        this.email = email;
        this.phone = phone;
        this.website = website;
        this.source = source;
        if (status != null && !status.isBlank()) {
            this.status = status;
        }
        this.priority = priority;
        this.industry = industry;
        this.designation = designation;
        this.estimatedValue = estimatedValue;
        this.expectedCloseDate = expectedCloseDate;
        this.description = description;
    }

    public void assign(UUID ownerId) {
        this.ownerId = ownerId;
    }

    public void changeStatus(String status) {
        if (status != null && !status.isBlank()) {
            this.status = status.trim();
        }
    }

    public void markConverted(UUID accountId, UUID contactId, UUID dealId) {
        this.status = "CONVERTED";
        this.convertedAccountId = accountId;
        this.convertedContactId = contactId;
        this.convertedDealId = dealId;
        this.convertedAt = Instant.now();
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
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

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getCompanyName() {
        return companyName;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public String getWebsite() {
        return website;
    }

    public String getSource() {
        return source;
    }

    public String getStatus() {
        return status;
    }

    public String getPriority() {
        return priority;
    }

    public String getIndustry() {
        return industry;
    }

    public String getDesignation() {
        return designation;
    }

    public BigDecimal getEstimatedValue() {
        return estimatedValue;
    }

    public LocalDate getExpectedCloseDate() {
        return expectedCloseDate;
    }

    public String getDescription() {
        return description;
    }

    public UUID getConvertedAccountId() {
        return convertedAccountId;
    }

    public UUID getConvertedContactId() {
        return convertedContactId;
    }

    public UUID getConvertedDealId() {
        return convertedDealId;
    }

    public Instant getConvertedAt() {
        return convertedAt;
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
