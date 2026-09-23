package com.techearnest.crm.activity.domain;

import com.techearnest.crm.common.security.SecuredRecord;
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
@Table(name = "activities")
@EntityListeners(AuditingEntityListener.class)
public class Activity implements SecuredRecord {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id")
    private UUID regionId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String subject;

    private String description;

    @Column(nullable = false)
    private String status;

    private String priority;

    @Column(name = "due_date")
    private Instant dueDate;

    @Column(name = "assigned_to")
    private UUID assignedTo;

    @Column(name = "related_entity_type", nullable = false)
    private String relatedEntityType;

    @Column(name = "related_entity_id", nullable = false)
    private UUID relatedEntityId;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(length = 255)
    private String location;

    @Column(columnDefinition = "TEXT")
    private String attendees;

    @Column(length = 64)
    private String outcome;

    @Column(name = "call_direction", length = 16)
    private String callDirection;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

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

    public static Activity create(
            UUID organizationId,
            UUID regionId,
            String type,
            String subject,
            String description,
            String status,
            String priority,
            Instant dueDate,
            UUID assignedTo,
            String relatedEntityType,
            UUID relatedEntityId,
            String location,
            String attendees,
            String outcome,
            String callDirection,
            Integer durationSeconds) {
        Activity activity = new Activity();
        activity.id = UUID.randomUUID();
        activity.organizationId = organizationId;
        activity.regionId = regionId;
        activity.type = type;
        activity.subject = subject;
        activity.description = description;
        activity.status = status != null && !status.isBlank() ? status : "OPEN";
        activity.priority = priority;
        activity.dueDate = dueDate;
        activity.assignedTo = assignedTo;
        activity.relatedEntityType = relatedEntityType;
        activity.relatedEntityId = relatedEntityId;
        activity.location = location;
        activity.attendees = attendees;
        activity.outcome = outcome;
        activity.callDirection = callDirection;
        activity.durationSeconds = durationSeconds;
        return activity;
    }

    public void update(
            String type,
            String subject,
            String description,
            String status,
            String priority,
            Instant dueDate,
            UUID assignedTo,
            String location,
            String attendees,
            String outcome,
            String callDirection,
            Integer durationSeconds) {
        if (type != null && !type.isBlank()) {
            this.type = type;
        }
        this.subject = subject;
        this.description = description;
        if (status != null && !status.isBlank()) {
            this.status = status;
        }
        this.priority = priority;
        this.dueDate = dueDate;
        this.assignedTo = assignedTo;
        this.location = location;
        this.attendees = attendees;
        this.outcome = outcome;
        this.callDirection = callDirection;
        this.durationSeconds = durationSeconds;
    }

    public void complete() {
        this.status = "COMPLETED";
        this.completedAt = Instant.now();
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }

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

    /** Visibility: treat creator as owner; assignee via getAssignedUserId. */
    @Override
    public UUID getOwnerId() {
        return createdBy != null ? createdBy : assignedTo;
    }

    @Override
    public UUID getAssignedUserId() {
        return assignedTo;
    }

    public String getType() {
        return type;
    }

    public String getSubject() {
        return subject;
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

    public Instant getDueDate() {
        return dueDate;
    }

    public UUID getAssignedTo() {
        return assignedTo;
    }

    public String getRelatedEntityType() {
        return relatedEntityType;
    }

    public UUID getRelatedEntityId() {
        return relatedEntityId;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public String getLocation() {
        return location;
    }

    public String getAttendees() {
        return attendees;
    }

    public String getOutcome() {
        return outcome;
    }

    public String getCallDirection() {
        return callDirection;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
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

    public UUID getCreatedBy() {
        return createdBy;
    }
}
