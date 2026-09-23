package com.techearnest.crm.metadata.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysListLayoutRepository extends JpaRepository<SysListLayout, UUID> {

    @Query(
            """
            select l from SysListLayout l
            where l.tableId = :tableId
              and (l.organizationId is null or l.organizationId = :organizationId)
              and ((:roleId is null and l.roleId is null) or l.roleId = :roleId)
            order by case when l.organizationId is null then 1 else 0 end,
                     case when l.status = 'DRAFT' then 0 when l.status = 'PUBLISHED' then 1 else 2 end,
                     l.updatedAt desc
            """)
    List<SysListLayout> findForTable(
            @Param("organizationId") UUID organizationId,
            @Param("tableId") UUID tableId,
            @Param("roleId") UUID roleId);

    @Query(
            """
            select l from SysListLayout l
            where l.tableId = :tableId
              and l.status = 'PUBLISHED'
              and (l.organizationId is null or l.organizationId = :organizationId)
              and ((:roleId is null and l.roleId is null) or l.roleId = :roleId)
            order by case when l.organizationId is null then 1 else 0 end
            """)
    List<SysListLayout> findPublished(
            @Param("organizationId") UUID organizationId,
            @Param("tableId") UUID tableId,
            @Param("roleId") UUID roleId);

    @Query(
            """
            select l from SysListLayout l
            where l.tableId = :tableId
              and l.status = 'DRAFT'
              and l.organizationId = :organizationId
              and ((:roleId is null and l.roleId is null) or l.roleId = :roleId)
            """)
    Optional<SysListLayout> findOrgDraft(
            @Param("organizationId") UUID organizationId,
            @Param("tableId") UUID tableId,
            @Param("roleId") UUID roleId);

    @Query(
            """
            select l from SysListLayout l
            where l.tableId = :tableId
              and l.status = 'PUBLISHED'
              and l.organizationId = :organizationId
              and ((:roleId is null and l.roleId is null) or l.roleId = :roleId)
            """)
    Optional<SysListLayout> findOrgPublished(
            @Param("organizationId") UUID organizationId,
            @Param("tableId") UUID tableId,
            @Param("roleId") UUID roleId);
}
