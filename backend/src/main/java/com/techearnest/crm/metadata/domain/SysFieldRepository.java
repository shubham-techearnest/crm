package com.techearnest.crm.metadata.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysFieldRepository extends JpaRepository<SysField, UUID> {

    @Query(
            """
            select f from SysField f
            where f.tableId = :tableId
              and (f.organizationId is null or f.organizationId = :organizationId)
            order by f.sortOrder asc, f.label asc
            """)
    List<SysField> findEffectiveForTable(
            @Param("organizationId") UUID organizationId, @Param("tableId") UUID tableId);

    @Query("select f from SysField f where f.id = :id")
    Optional<SysField> findByIdActive(@Param("id") UUID id);

    @Query(
            """
            select count(f) from SysField f
            where f.tableId = :tableId
              and f.organizationId = :organizationId
              and f.system = false
              and f.active = true
            """)
    long countActiveCustomFields(
            @Param("organizationId") UUID organizationId, @Param("tableId") UUID tableId);

    boolean existsByOrganizationIdAndTableIdAndCode(UUID organizationId, UUID tableId, String code);
}
