package com.techearnest.crm.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "platform_prospect_orgs")
@EntityListeners(AuditingEntityListener.class)
public class PlatformProspectOrg {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "legal_name")
    private String legalName;

    private String website;
    private String email;
    private String phone;
    private String source;

    @Column(nullable = false)
    private String stage;

    @Column(name = "estimated_arr", precision = 18, scale = 2)
    private BigDecimal estimatedArr;

    @Column(name = "owner_user_id")
    private UUID ownerUserId;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "linked_organization_id")
    private UUID linkedOrganizationId;

    @Column(name = "deleted_at")
    private Instant deletedAt;

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

    public static PlatformProspectOrg create(
            String name,
            String legalName,
            String website,
            String email,
            String phone,
            String source,
            String stage,
            BigDecimal estimatedArr,
            UUID ownerUserId,
            String notes) {
        PlatformProspectOrg p = new PlatformProspectOrg();
        p.id = UUID.randomUUID();
        p.name = name;
        p.legalName = legalName;
        p.website = website;
        p.email = email;
        p.phone = phone;
        p.source = source;
        p.stage = stage == null || stage.isBlank() ? "NEW" : stage.trim().toUpperCase();
        p.estimatedArr = estimatedArr;
        p.ownerUserId = ownerUserId;
        p.notes = notes;
        return p;
    }

    public void update(
            String name,
            String legalName,
            String website,
            String email,
            String phone,
            String source,
            String stage,
            BigDecimal estimatedArr,
            UUID ownerUserId,
            String notes) {
        this.name = name;
        this.legalName = legalName;
        this.website = website;
        this.email = email;
        this.phone = phone;
        this.source = source;
        if (stage != null && !stage.isBlank()) {
            this.stage = stage.trim().toUpperCase();
        }
        this.estimatedArr = estimatedArr;
        this.ownerUserId = ownerUserId;
        this.notes = notes;
    }

    public void linkOrganization(UUID organizationId) {
        this.linkedOrganizationId = organizationId;
        this.stage = "WON";
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getLegalName() {
        return legalName;
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

    public String getSource() {
        return source;
    }

    public String getStage() {
        return stage;
    }

    public BigDecimal getEstimatedArr() {
        return estimatedArr;
    }

    public UUID getOwnerUserId() {
        return ownerUserId;
    }

    public String getNotes() {
        return notes;
    }

    public UUID getLinkedOrganizationId() {
        return linkedOrganizationId;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
