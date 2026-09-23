package com.techearnest.crm.metadata.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysFormPolicyRepository extends JpaRepository<SysFormPolicy, UUID> {

    @Query(
            """
            select p from SysFormPolicy p
            where p.tableId = :tableId
              and p.layoutKey = :layoutKey
              and p.status = 'PUBLISHED'
              and p.active = true
              and (p.organizationId is null or p.organizationId = :organizationId)
            order by case when p.organizationId is null then 1 else 0 end, p.name asc
            """)
    List<SysFormPolicy> findPublished(
            @Param("organizationId") UUID organizationId,
            @Param("tableId") UUID tableId,
            @Param("layoutKey") String layoutKey);

    @Query(
            """
            select p from SysFormPolicy p
            where p.tableId = :tableId
              and (p.organizationId is null or p.organizationId = :organizationId)
            order by p.name asc, p.updatedAt desc
            """)
    List<SysFormPolicy> findForTable(
            @Param("organizationId") UUID organizationId, @Param("tableId") UUID tableId);

    Optional<SysFormPolicy> findByIdAndOrganizationId(UUID id, UUID organizationId);
}
