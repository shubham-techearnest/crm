package com.techearnest.crm.project.domain;

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
@Table(name = "project_tasks")
@EntityListeners(AuditingEntityListener.class)
public class ProjectTask implements Persistable<UUID> {

    @Id
    private UUID id;

    @Transient
    private boolean newEntity = true;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "milestone_id")
    private UUID milestoneId;

    @Column(name = "parent_task_id")
    private UUID parentTaskId;

    @Column(name = "assigned_resource_id")
    private UUID assignedResourceId;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(nullable = false)
    private String status;

    private String priority;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "estimated_hours")
    private BigDecimal estimatedHours;

    @Column(name = "actual_hours", nullable = false)
    private BigDecimal actualHours;

    @Column(name = "completion_percentage", nullable = false)
    private BigDecimal completionPercentage;

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

    public static ProjectTask create(
            UUID organizationId,
            UUID projectId,
            UUID milestoneId,
            UUID parentTaskId,
            UUID assignedResourceId,
            String name,
            String description,
            String status,
            String priority,
            LocalDate startDate,
            LocalDate dueDate,
            BigDecimal estimatedHours,
            BigDecimal completionPercentage) {
        ProjectTask task = new ProjectTask();
        task.id = UUID.randomUUID();
        task.organizationId = organizationId;
        task.projectId = projectId;
        task.milestoneId = milestoneId;
        task.parentTaskId = parentTaskId;
        task.assignedResourceId = assignedResourceId;
        task.name = name;
        task.description = description;
        task.status = status != null && !status.isBlank() ? status : "TODO";
        task.priority = priority;
        task.startDate = startDate;
        task.dueDate = dueDate;
        task.estimatedHours = estimatedHours;
        task.actualHours = BigDecimal.ZERO;
        task.completionPercentage =
                completionPercentage != null ? completionPercentage : BigDecimal.ZERO;
        if ("COMPLETED".equals(task.status)) {
            task.completionPercentage = new BigDecimal("100");
        }
        return task;
    }

    public void update(
            UUID milestoneId,
            UUID parentTaskId,
            String name,
            String description,
            String status,
            String priority,
            LocalDate startDate,
            LocalDate dueDate,
            BigDecimal estimatedHours,
            BigDecimal actualHours,
            BigDecimal completionPercentage) {
        this.milestoneId = milestoneId;
        this.parentTaskId = parentTaskId;
        if (name != null && !name.isBlank()) {
            this.name = name;
        }
        this.description = description;
        if (status != null && !status.isBlank()) {
            this.status = status;
            if ("COMPLETED".equals(status)) {
                this.completionPercentage = new BigDecimal("100");
            }
        }
        this.priority = priority;
        this.startDate = startDate;
        this.dueDate = dueDate;
        this.estimatedHours = estimatedHours;
        if (actualHours != null) {
            this.actualHours = actualHours;
        }
        if (completionPercentage != null && !"COMPLETED".equals(this.status)) {
            this.completionPercentage = completionPercentage;
        }
    }

    public void assign(UUID assignedResourceId) {
        this.assignedResourceId = assignedResourceId;
    }

    public void addActualHours(BigDecimal hours) {
        if (hours == null) {
            return;
        }
        this.actualHours = (this.actualHours == null ? BigDecimal.ZERO : this.actualHours).add(hours);
    }

    public void setCompletionPercentage(BigDecimal completionPercentage) {
        this.completionPercentage = completionPercentage;
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

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getMilestoneId() {
        return milestoneId;
    }

    public UUID getParentTaskId() {
        return parentTaskId;
    }

    public UUID getAssignedResourceId() {
        return assignedResourceId;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getStatus() {
        return status;
    }

    public String getPriority() {
        return priority;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public BigDecimal getEstimatedHours() {
        return estimatedHours;
    }

    public BigDecimal getActualHours() {
        return actualHours;
    }

    public BigDecimal getCompletionPercentage() {
        return completionPercentage;
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

    public UUID getCreatedBy() {
        return createdBy;
    }
}
