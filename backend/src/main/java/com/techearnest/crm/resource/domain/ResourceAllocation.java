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

    public static final String STATUS_PLANNED = "PLANNED";
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_CANCELLED = "CANCELLED";
    public static final java.util.Set<String> STATUSES =
            java.util.Set.of(STATUS_PLANNED, STATUS_ACTIVE, STATUS_COMPLETED, STATUS_CANCELLED);

    public static final String SOURCE_MANUAL = "MANUAL";
    public static final String SOURCE_ONBOARDING = "ONBOARDING";
    public static final String SOURCE_IMPORT = "IMPORT";
    public static final String SOURCE_PROJECT = "PROJECT";
    public static final java.util.Set<String> SOURCES =
            java.util.Set.of(SOURCE_MANUAL, SOURCE_ONBOARDING, SOURCE_IMPORT, SOURCE_PROJECT);

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

    @Column(nullable = false)
    private boolean billable = true;

    @Column(nullable = false)
    private String source = SOURCE_MANUAL;

    private String notes;

    @Column(name = "milestone_id")
    private UUID milestoneId;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "ended_by")
    private UUID endedBy;

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

    /** Null leaves a value unchanged; a blank note clears it. */
    public void updateTerms(Boolean billable, String source, String notes, UUID milestoneId) {
        if (billable != null) {
            this.billable = billable;
        }
        if (source != null && !source.isBlank()) {
            this.source = source;
        }
        if (notes != null) {
            this.notes = notes.isBlank() ? null : notes.trim();
        }
        if (milestoneId != null) {
            this.milestoneId = milestoneId;
        }
    }

    public void clearMilestone() {
        this.milestoneId = null;
    }

    /**
     * Ends the allocation on {@code endDate} and keeps it as history: work already started is COMPLETED,
     * an allocation that never started is CANCELLED.
     */
    public void end(LocalDate endDate, UUID endedBy) {
        if (endDate.isBefore(startDate)) {
            this.endDate = startDate;
            this.status = STATUS_CANCELLED;
        } else {
            this.endDate = endDate.isBefore(this.endDate) ? endDate : this.endDate;
            this.status = STATUS_COMPLETED;
        }
        this.endedAt = Instant.now();
        this.endedBy = endedBy;
    }

    public boolean isOpen() {
        return deletedAt == null && (STATUS_ACTIVE.equals(status) || STATUS_PLANNED.equals(status));
    }

    public boolean covers(LocalDate date) {
        return !date.isBefore(startDate) && !date.isAfter(endDate);
    }

    public boolean isBillable() {
        return billable;
    }

    public String getSource() {
        return source;
    }

    public String getNotes() {
        return notes;
    }

    public UUID getMilestoneId() {
        return milestoneId;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public UUID getEndedBy() {
        return endedBy;
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
