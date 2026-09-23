package com.techearnest.crm.workflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "workflow_actions")
public class WorkflowAction {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "definition_id", nullable = false)
    private UUID definitionId;

    @Column(name = "action_order", nullable = false)
    private int actionOrder;

    @Column(name = "action_type", nullable = false, length = 32)
    private String actionType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config_json", nullable = false, columnDefinition = "jsonb")
    private String configJson = "{}";

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static WorkflowAction create(
            UUID organizationId, UUID definitionId, int order, String actionType, String configJson) {
        WorkflowAction action = new WorkflowAction();
        action.id = UUID.randomUUID();
        action.organizationId = organizationId;
        action.definitionId = definitionId;
        action.actionOrder = order;
        action.actionType = actionType;
        action.configJson = configJson == null || configJson.isBlank() ? "{}" : configJson;
        action.active = true;
        action.createdAt = Instant.now();
        return action;
    }

    public UUID getId() {
        return id;
    }

    public UUID getDefinitionId() {
        return definitionId;
    }

    public int getActionOrder() {
        return actionOrder;
    }

    public String getActionType() {
        return actionType;
    }

    public String getConfigJson() {
        return configJson;
    }

    public boolean isActive() {
        return active;
    }
}
