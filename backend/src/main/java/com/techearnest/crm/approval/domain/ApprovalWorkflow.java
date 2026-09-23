package com.techearnest.crm.approval.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "approval_workflows")
public class ApprovalWorkflow {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "target_type", nullable = false, length = 64)
    private String targetType;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private int version = 1;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    public static ApprovalWorkflow create(
            UUID organizationId, String targetType, String code, String name, UUID createdBy) {
        ApprovalWorkflow workflow = new ApprovalWorkflow();
        workflow.id = UUID.randomUUID();
        workflow.organizationId = organizationId;
        workflow.targetType = targetType;
        workflow.code = code;
        workflow.name = name;
        workflow.active = true;
        workflow.version = 1;
        workflow.createdAt = Instant.now();
        workflow.updatedAt = Instant.now();
        workflow.createdBy = createdBy;
        workflow.updatedBy = createdBy;
        return workflow;
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public String getTargetType() {
        return targetType;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public boolean isActive() {
        return active;
    }

    public int getVersion() {
        return version;
    }
}
