package com.techearnest.crm.common.outbox;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "domain_events")
public class DomainEventRecord {

    @Id
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "event_type", nullable = false, length = 128)
    private String eventType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String payload = "{}";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(nullable = false)
    private int attempts = 0;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @Column(name = "available_at", nullable = false)
    private Instant availableAt = Instant.now();

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Column(name = "entity_type", length = 64)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    public static DomainEventRecord create(
            UUID organizationId,
            String eventType,
            String payloadJson,
            String idempotencyKey,
            String entityType,
            UUID entityId) {
        DomainEventRecord row = new DomainEventRecord();
        row.id = UUID.randomUUID();
        row.organizationId = organizationId;
        row.eventType = eventType;
        row.payload = payloadJson == null || payloadJson.isBlank() ? "{}" : payloadJson;
        row.createdAt = Instant.now();
        row.availableAt = Instant.now();
        row.attempts = 0;
        row.idempotencyKey = idempotencyKey;
        row.entityType = entityType;
        row.entityId = entityId;
        return row;
    }

    public void markProcessed() {
        this.processedAt = Instant.now();
        this.lastError = null;
    }

    public void markFailed(String error) {
        this.attempts += 1;
        this.lastError = error;
        this.availableAt = Instant.now().plusSeconds(Math.min(300L, 5L * this.attempts));
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public String getEventType() {
        return eventType;
    }

    public String getPayload() {
        return payload;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }

    public String getEntityType() {
        return entityType;
    }

    public UUID getEntityId() {
        return entityId;
    }
}
