package com.techearnest.crm.common.event;

import java.time.Instant;
import java.util.UUID;

/**
 * Marker for in-process domain events. V2 workflow listeners will subscribe to these.
 */
public abstract class DomainEvent {

    private final UUID eventId = UUID.randomUUID();
    private final Instant occurredAt = Instant.now();
    private final UUID organizationId;

    protected DomainEvent(UUID organizationId) {
        this.organizationId = organizationId;
    }

    public UUID getEventId() {
        return eventId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }
}
