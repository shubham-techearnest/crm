package com.techearnest.crm.approval.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "approval_steps")
public class ApprovalStep {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "workflow_id", nullable = false)
    private UUID workflowId;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Column(nullable = false, length = 16)
    private String mode = "SEQUENTIAL";

    @Column(name = "approver_type", nullable = false, length = 32)
    private String approverType;

    @Column(name = "approver_ref", length = 128)
    private String approverRef;

    @Column(name = "required_approvals", nullable = false)
    private int requiredApprovals = 1;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static ApprovalStep create(
            UUID organizationId,
            UUID workflowId,
            int stepOrder,
            String mode,
            String approverType,
            String approverRef,
            int requiredApprovals) {
        ApprovalStep step = new ApprovalStep();
        step.id = UUID.randomUUID();
        step.organizationId = organizationId;
        step.workflowId = workflowId;
        step.stepOrder = stepOrder;
        step.mode = mode == null || mode.isBlank() ? "SEQUENTIAL" : mode;
        step.approverType = approverType;
        step.approverRef = approverRef;
        step.requiredApprovals = requiredApprovals < 1 ? 1 : requiredApprovals;
        step.active = true;
        step.createdAt = Instant.now();
        step.updatedAt = Instant.now();
        return step;
    }

    public UUID getId() {
        return id;
    }

    public UUID getWorkflowId() {
        return workflowId;
    }

    public int getStepOrder() {
        return stepOrder;
    }

    public String getMode() {
        return mode;
    }

    public String getApproverType() {
        return approverType;
    }

    public String getApproverRef() {
        return approverRef;
    }
}
