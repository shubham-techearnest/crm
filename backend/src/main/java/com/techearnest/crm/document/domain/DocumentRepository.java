package com.techearnest.crm.document.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    @Query(
            """
            select d from Document d
            where d.organizationId = :organizationId
              and d.entityType = :entityType
              and d.entityId = :entityId
            order by d.createdAt desc
            """)
    List<Document> findByEntity(
            @Param("organizationId") UUID organizationId,
            @Param("entityType") String entityType,
            @Param("entityId") UUID entityId);

    @Query(
            """
            select d from Document d
            where d.organizationId = :organizationId
              and coalesce(:entityType, d.entityType) = d.entityType
              and coalesce(:visibility, d.visibility) = d.visibility
              and coalesce(:uploadedBy, d.uploadedBy) = d.uploadedBy
              and coalesce(:fromTs, d.createdAt) <= d.createdAt
              and coalesce(:toTs, d.createdAt) >= d.createdAt
            order by d.createdAt desc
            """)
    List<Document> searchRecent(
            @Param("organizationId") UUID organizationId,
            @Param("entityType") String entityType,
            @Param("visibility") String visibility,
            @Param("uploadedBy") UUID uploadedBy,
            @Param("fromTs") java.time.Instant fromTs,
            @Param("toTs") java.time.Instant toTs,
            org.springframework.data.domain.Pageable pageable);

    @Query("select d from Document d where d.id = :id")
    Optional<Document> findByIdActive(@Param("id") UUID id);
}
