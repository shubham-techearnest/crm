package com.techearnest.crm.timesheet.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "time_entries")
@EntityListeners(AuditingEntityListener.class)
public class TimeEntry {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "timesheet_id", nullable = false)
    private UUID timesheetId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "task_id")
    private UUID taskId;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(nullable = false)
    private BigDecimal hours;

    private String description;

    @Column(nullable = false)
    private boolean billable;

    @Column(name = "billing_rate")
    private BigDecimal billingRate;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static TimeEntry create(
            UUID organizationId,
            UUID timesheetId,
            UUID projectId,
            UUID taskId,
            LocalDate workDate,
            BigDecimal hours,
            String description,
            boolean billable,
            BigDecimal billingRate) {
        TimeEntry entry = new TimeEntry();
        entry.id = UUID.randomUUID();
        entry.organizationId = organizationId;
        entry.timesheetId = timesheetId;
        entry.projectId = projectId;
        entry.taskId = taskId;
        entry.workDate = workDate;
        entry.hours = hours;
        entry.description = description;
        entry.billable = billable;
        entry.billingRate = billingRate;
        return entry;
    }

    public void update(
            UUID projectId,
            UUID taskId,
            LocalDate workDate,
            BigDecimal hours,
            String description,
            Boolean billable,
            BigDecimal billingRate) {
        if (projectId != null) {
            this.projectId = projectId;
        }
        if (taskId != null) {
            this.taskId = taskId;
        }
        if (workDate != null) {
            this.workDate = workDate;
        }
        if (hours != null) {
            this.hours = hours;
        }
        if (description != null) {
            this.description = description.isBlank() ? null : description;
        }
        if (billable != null) {
            this.billable = billable;
        }
        if (billingRate != null) {
            this.billingRate = billingRate;
        }
    }

    public void clearTaskId() {
        this.taskId = null;
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

    public UUID getTimesheetId() {
        return timesheetId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getTaskId() {
        return taskId;
    }

    public LocalDate getWorkDate() {
        return workDate;
    }

    public BigDecimal getHours() {
        return hours;
    }

    public String getDescription() {
        return description;
    }

    public boolean isBillable() {
        return billable;
    }

    public BigDecimal getBillingRate() {
        return billingRate;
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
