package com.techearnest.crm.resource.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "resource_allocations")
@EntityListeners(AuditingEntityListener.class)
public class ResourceAllocation {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "resource_id", nullable = false)
    private UUID resourceId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "allocated_hours")
    private BigDecimal allocatedHours;

    @Column(name = "allocation_percentage")
    private BigDecimal allocationPercentage;

    private String role;

    @Column(name = "billing_rate")
    private BigDecimal billingRate;

    @Column(name = "cost_rate")
    private BigDecimal costRate;

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

    public static ResourceAllocation create(
            UUID organizationId,
            UUID projectId,
            UUID resourceId,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal allocatedHours,
            BigDecimal allocationPercentage,
            String role,
            BigDecimal billingRate,
            BigDecimal costRate,
            String status) {
        ResourceAllocation allocation = new ResourceAllocation();
        allocation.id = UUID.randomUUID();
        allocation.organizationId = organizationId;
        allocation.projectId = projectId;
        allocation.resourceId = resourceId;
        allocation.startDate = startDate;
        allocation.endDate = endDate;
        allocation.allocatedHours = allocatedHours;
        allocation.allocationPercentage = allocationPercentage;
        allocation.role = role;
        allocation.billingRate = billingRate;
        allocation.costRate = costRate;
        allocation.status = status != null && !status.isBlank() ? status : "PLANNED";
        return allocation;
    }

    public void update(
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal allocatedHours,
            BigDecimal allocationPercentage,
            String role,
            BigDecimal billingRate,
            BigDecimal costRate,
            String status) {
        if (startDate != null) {
            this.startDate = startDate;
        }
        if (endDate != null) {
            this.endDate = endDate;
        }
        this.allocatedHours = allocatedHours;
        this.allocationPercentage = allocationPercentage;
        this.role = role;
        this.billingRate = billingRate;
        this.costRate = costRate;
        if (status != null && !status.isBlank()) {
            this.status = status;
        }
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getResourceId() {
        return resourceId;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public BigDecimal getAllocatedHours() {
        return allocatedHours;
    }

    public BigDecimal getAllocationPercentage() {
        return allocationPercentage;
    }

    public String getRole() {
        return role;
    }

    public BigDecimal getBillingRate() {
        return billingRate;
    }

    public BigDecimal getCostRate() {
        return costRate;
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
