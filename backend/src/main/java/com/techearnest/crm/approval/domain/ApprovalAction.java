package com.techearnest.crm.approval.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "approval_actions")
public class ApprovalAction {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "request_id", nullable = false)
    private UUID requestId;

    @Column(name = "step_id")
    private UUID stepId;

    @Column(name = "actor_id", nullable = false)
    private UUID actorId;

    @Column(nullable = false, length = 16)
    private String action;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static ApprovalAction create(
            UUID organizationId, UUID requestId, UUID stepId, UUID actorId, String action, String comment) {
        ApprovalAction row = new ApprovalAction();
        row.id = UUID.randomUUID();
        row.organizationId = organizationId;
        row.requestId = requestId;
        row.stepId = stepId;
        row.actorId = actorId;
        row.action = action;
        row.comment = comment;
        row.createdAt = Instant.now();
        return row;
    }

    public UUID getId() {
        return id;
    }

    public UUID getRequestId() {
        return requestId;
    }

    public String getAction() {
        return action;
    }

    public UUID getActorId() {
        return actorId;
    }
}
