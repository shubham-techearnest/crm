package com.techearnest.crm.metadata.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysFormLayoutRepository extends JpaRepository<SysFormLayout, UUID> {

    @Query(
            """
            select l from SysFormLayout l
            where l.tableId = :tableId
              and l.layoutKey = :layoutKey
              and (l.organizationId is null or l.organizationId = :organizationId)
            order by case when l.organizationId is null then 1 else 0 end,
                     case when l.status = 'DRAFT' then 0 when l.status = 'PUBLISHED' then 1 else 2 end,
                     l.updatedAt desc
            """)
    List<SysFormLayout> findForTableAndKey(
            @Param("organizationId") UUID organizationId,
            @Param("tableId") UUID tableId,
            @Param("layoutKey") String layoutKey);

    @Query(
            """
            select l from SysFormLayout l
            where l.tableId = :tableId
              and l.layoutKey = :layoutKey
              and l.status = 'PUBLISHED'
              and (l.organizationId is null or l.organizationId = :organizationId)
            order by case when l.organizationId is null then 1 else 0 end
            """)
    List<SysFormLayout> findPublished(
            @Param("organizationId") UUID organizationId,
            @Param("tableId") UUID tableId,
            @Param("layoutKey") String layoutKey);

    @Query(
            """
            select l from SysFormLayout l
            where l.tableId = :tableId
              and l.layoutKey = :layoutKey
              and l.status = 'DRAFT'
              and l.organizationId = :organizationId
            """)
    Optional<SysFormLayout> findOrgDraft(
            @Param("organizationId") UUID organizationId,
            @Param("tableId") UUID tableId,
            @Param("layoutKey") String layoutKey);

    @Query(
            """
            select l from SysFormLayout l
            where l.tableId = :tableId
              and l.layoutKey = :layoutKey
              and l.status = 'PUBLISHED'
              and l.organizationId = :organizationId
            """)
    Optional<SysFormLayout> findOrgPublished(
            @Param("organizationId") UUID organizationId,
            @Param("tableId") UUID tableId,
            @Param("layoutKey") String layoutKey);
}
