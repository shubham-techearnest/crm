package com.techearnest.crm.approval.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "approval_requests")
public class ApprovalRequest {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "workflow_id", nullable = false)
    private UUID workflowId;

    @Column(name = "target_type", nullable = false, length = 64)
    private String targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Column(nullable = false, length = 32)
    private String status = "PENDING";

    @Column(name = "current_step_id")
    private UUID currentStepId;

    @Column(name = "submitted_by", nullable = false)
    private UUID submittedBy;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt = Instant.now();

    @Column(name = "region_id")
    private UUID regionId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static ApprovalRequest create(
            UUID organizationId,
            UUID workflowId,
            String targetType,
            UUID targetId,
            UUID currentStepId,
            UUID submittedBy,
            UUID regionId) {
        ApprovalRequest request = new ApprovalRequest();
        request.id = UUID.randomUUID();
        request.organizationId = organizationId;
        request.workflowId = workflowId;
        request.targetType = targetType;
        request.targetId = targetId;
        request.status = "PENDING";
        request.currentStepId = currentStepId;
        request.submittedBy = submittedBy;
        request.submittedAt = Instant.now();
        request.regionId = regionId;
        request.createdAt = Instant.now();
        request.updatedAt = Instant.now();
        return request;
    }

    public void markApproved() {
        this.status = "APPROVED";
        this.updatedAt = Instant.now();
    }

    public void markRejected() {
        this.status = "REJECTED";
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getWorkflowId() {
        return workflowId;
    }

    public String getTargetType() {
        return targetType;
    }

    public UUID getTargetId() {
        return targetId;
    }

    public String getStatus() {
        return status;
    }

    public UUID getCurrentStepId() {
        return currentStepId;
    }

    public UUID getSubmittedBy() {
        return submittedBy;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public UUID getRegionId() {
        return regionId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
