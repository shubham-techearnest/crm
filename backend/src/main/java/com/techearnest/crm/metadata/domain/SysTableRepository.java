package com.techearnest.crm.metadata.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SysTableRepository extends JpaRepository<SysTable, UUID> {

    @Query(
            """
            select t from SysTable t
            where t.organizationId is null
               or t.organizationId = :organizationId
            order by t.moduleGroup asc, t.label asc
            """)
    List<SysTable> findEffectiveForOrg(@Param("organizationId") UUID organizationId);

    @Query("select t from SysTable t where t.id = :id")
    Optional<SysTable> findByIdActive(@Param("id") UUID id);

    @Query(
            """
            select t from SysTable t
            where t.code = :code
              and (t.organizationId is null or t.organizationId = :organizationId)
            order by case when t.organizationId is null then 1 else 0 end
            """)
    List<SysTable> findByCodePreferringOrg(
            @Param("organizationId") UUID organizationId, @Param("code") String code);

    boolean existsByOrganizationIdAndCode(UUID organizationId, String code);
}
