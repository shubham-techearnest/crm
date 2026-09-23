package com.techearnest.crm.audit.domain;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @Query(
            """
            select a from AuditLog a
            where a.organizationId = :organizationId
              and (:action is null or a.action = :action)
              and (:entityType is null or a.entityType = :entityType)
              and (:userId is null or a.userId = :userId)
              and (:regionId is null or a.regionId = :regionId)
              and (:entityId is null or a.entityId = :entityId)
              and (:fromTs is null or a.createdAt >= :fromTs)
              and (:toTs is null or a.createdAt <= :toTs)
            """)
    Page<AuditLog> searchByOrganization(
            @Param("organizationId") UUID organizationId,
            @Param("action") String action,
            @Param("entityType") String entityType,
            @Param("userId") UUID userId,
            @Param("regionId") UUID regionId,
            @Param("entityId") UUID entityId,
            @Param("fromTs") Instant fromTs,
            @Param("toTs") Instant toTs,
            Pageable pageable);
}
