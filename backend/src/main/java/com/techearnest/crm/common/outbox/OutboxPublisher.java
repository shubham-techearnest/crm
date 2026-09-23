package com.techearnest.crm.common.outbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboxPublisher {

    private final DomainEventRepository repository;
    private final ObjectMapper objectMapper;

    public OutboxPublisher(DomainEventRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public UUID append(
            UUID organizationId,
            String eventType,
            Map<String, Object> payload,
            String idempotencyKey,
            String entityType,
            UUID entityId) {
        String json;
        try {
            json = objectMapper.writeValueAsString(payload == null ? Map.of() : payload);
        } catch (JsonProcessingException e) {
            json = "{}";
        }
        try {
            DomainEventRecord saved = repository.save(DomainEventRecord.create(
                    organizationId, eventType, json, idempotencyKey, entityType, entityId));
            return saved.getId();
        } catch (DataIntegrityViolationException ex) {
            // idempotent append — duplicate key means already queued
            return null;
        }
    }
}
