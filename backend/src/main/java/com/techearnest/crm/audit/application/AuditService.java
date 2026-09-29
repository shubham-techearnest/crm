package com.techearnest.crm.audit.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techearnest.crm.audit.domain.AuditLog;
import com.techearnest.crm.audit.domain.AuditLogRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
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

    /**
     * Persist a non-secret summary in new_value (Studio publish / ACL before-after). The column is jsonb, so a
     * summary that is not valid JSON is stored as {"summary": "..."} rather than failing the caller's transaction.
     */
    @Transactional
    public void recordWithSummary(
            UUID organizationId,
            UUID userId,
            String action,
            String entityType,
            UUID entityId,
            String summaryJson) {
        auditLogRepository.save(
                AuditLog.of(organizationId, null, userId, action, entityType, entityId, toJson(summaryJson)));
    }

    String toJson(String summary) {
        if (summary == null || summary.isBlank()) {
            return null;
        }
        try {
            objectMapper.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(summary);
            return summary;
        } catch (JsonProcessingException notJson) {
            try {
                return objectMapper.writeValueAsString(Map.of("summary", summary));
            } catch (JsonProcessingException impossible) {
                return null;
            }
        }
    }
}
