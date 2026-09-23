package com.techearnest.crm.audit.application;

import com.techearnest.crm.audit.domain.AuditLog;
import com.techearnest.crm.audit.domain.AuditLogRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public void record(UUID organizationId, UUID userId, String action, String entityType, UUID entityId) {
        auditLogRepository.save(AuditLog.of(organizationId, null, userId, action, entityType, entityId, null));
    }

    @Transactional
    public void record(
            UUID organizationId,
            UUID userId,
            String action,
            String entityType,
            UUID entityId,
            UUID regionId) {
        auditLogRepository.save(AuditLog.of(organizationId, regionId, userId, action, entityType, entityId, null));
    }

    /** Persist a non-secret JSON summary in new_value (Studio publish / ACL before-after). */
    @Transactional
    public void recordWithSummary(
            UUID organizationId,
            UUID userId,
            String action,
            String entityType,
            UUID entityId,
            String summaryJson) {
        auditLogRepository.save(
                AuditLog.of(organizationId, null, userId, action, entityType, entityId, summaryJson));
    }
}
