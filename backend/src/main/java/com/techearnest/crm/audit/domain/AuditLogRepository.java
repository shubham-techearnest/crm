package com.techearnest.crm.audit.domain;

import java.time.Instant;
import java.util.UUID;
import java.util.Collection;
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
              and coalesce(:fromTs, a.createdAt) <= a.createdAt
              and coalesce(:toTs, a.createdAt) >= a.createdAt
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

    @Query(
            """
            select a from AuditLog a
            where a.organizationId = :organizationId
              and a.regionId in :regionIds
              and (:action is null or a.action = :action)
              and (:entityType is null or a.entityType = :entityType)
              and (:userId is null or a.userId = :userId)
              and (:regionId is null or a.regionId = :regionId)
              and (:entityId is null or a.entityId = :entityId)
              and coalesce(:fromTs, a.createdAt) <= a.createdAt
              and coalesce(:toTs, a.createdAt) >= a.createdAt
            """)
    Page<AuditLog> searchByOrganizationAndRegions(
            @Param("organizationId") UUID organizationId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("action") String action,
            @Param("entityType") String entityType,
            @Param("userId") UUID userId,
            @Param("regionId") UUID regionId,
            @Param("entityId") UUID entityId,
            @Param("fromTs") Instant fromTs,
            @Param("toTs") Instant toTs,
            Pageable pageable);
}
