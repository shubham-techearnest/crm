package com.techearnest.crm.audit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "region_id")
    private UUID regionId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false)
    private String action;

    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_value", columnDefinition = "jsonb")
    private String newValue;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static AuditLog of(
            UUID organizationId, UUID userId, String action, String entityType, UUID entityId, String newValue) {
        return of(organizationId, null, userId, action, entityType, entityId, newValue);
    }

    public static AuditLog of(
            UUID organizationId,
            UUID regionId,
            UUID userId,
            String action,
            String entityType,
            UUID entityId,
            String newValue) {
        AuditLog log = new AuditLog();
        log.id = UUID.randomUUID();
        log.organizationId = organizationId;
        log.regionId = regionId;
        log.userId = userId;
        log.action = action;
        log.entityType = entityType;
        log.entityId = entityId;
        log.newValue = newValue;
        log.createdAt = Instant.now();
        return log;
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getRegionId() {
        return regionId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getAction() {
        return action;
    }

    public String getEntityType() {
        return entityType;
    }

    public UUID getEntityId() {
        return entityId;
    }

    public String getNewValue() {
        return newValue;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
