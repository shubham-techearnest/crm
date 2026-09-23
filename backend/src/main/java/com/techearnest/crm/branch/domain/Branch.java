package com.techearnest.crm.branch.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "branches")
@EntityListeners(AuditingEntityListener.class)
public class Branch {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(nullable = false)
    private String name;

    private String address;

    @Column(nullable = false)
    private String status;

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

    public static Branch create(UUID organizationId, UUID regionId, String name, String address) {
        Branch branch = new Branch();
        branch.id = UUID.randomUUID();
        branch.organizationId = organizationId;
        branch.regionId = regionId;
        branch.name = name;
        branch.address = address;
        branch.status = "ACTIVE";
        return branch;
    }

    public void update(String name, String address, UUID regionId, String status) {
        this.name = name;
        this.address = address;
        if (regionId != null) {
            this.regionId = regionId;
        }
        if (status != null && !status.isBlank()) {
            this.status = status;
        }
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.status = "INACTIVE";
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

    public String getName() {
        return name;
    }

    public String getAddress() {
        return address;
    }

    public String getStatus() {
        return status;
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
