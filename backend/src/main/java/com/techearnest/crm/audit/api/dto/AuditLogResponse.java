package com.techearnest.crm.audit.api.dto;

import com.techearnest.crm.audit.domain.AuditLog;
import java.time.Instant;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        UUID organizationId,
        UUID regionId,
        UUID userId,
        String action,
        String entityType,
        UUID entityId,
        String newValue,
        Instant createdAt) {

    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getOrganizationId(),
                log.getRegionId(),
                log.getUserId(),
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getNewValue(),
                log.getCreatedAt());
    }
}
