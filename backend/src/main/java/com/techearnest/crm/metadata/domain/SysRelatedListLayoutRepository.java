package com.techearnest.crm.metadata.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysRelatedListLayoutRepository extends JpaRepository<SysRelatedListLayout, UUID> {

    @Query(
            """
            select r from SysRelatedListLayout r
            where r.parentTableId = :parentTableId
              and r.status = 'PUBLISHED'
              and r.active = true
              and (r.organizationId is null or r.organizationId = :organizationId)
            order by case when r.organizationId is null then 1 else 0 end, r.sortOrder asc
            """)
    List<SysRelatedListLayout> findPublished(
            @Param("organizationId") UUID organizationId, @Param("parentTableId") UUID parentTableId);

    @Query(
            """
            select r from SysRelatedListLayout r
            where r.parentTableId = :parentTableId
              and (r.organizationId is null or r.organizationId = :organizationId)
            order by r.sortOrder asc, r.label asc
            """)
    List<SysRelatedListLayout> findForParent(
            @Param("organizationId") UUID organizationId, @Param("parentTableId") UUID parentTableId);

    Optional<SysRelatedListLayout> findByOrganizationIdAndParentTableIdAndChildTableCodeAndStatus(
            UUID organizationId, UUID parentTableId, String childTableCode, String status);
}
