package com.techearnest.crm.role.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    @Query(
            """
            select distinct r from Role r
            left join fetch r.permissions
            where r.deletedAt is null
              and (r.organizationId is null or r.organizationId = :organizationId)
            order by r.name
            """)
    List<Role> findVisibleForOrganization(@Param("organizationId") UUID organizationId);

    @Query(
            """
            select distinct r from Role r
            left join fetch r.permissions
            where r.id = :id and r.deletedAt is null
            """)
    Optional<Role> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select r from Role r
            where r.deletedAt is null and r.id in :ids
            """)
    List<Role> findActiveByIdIn(@Param("ids") Iterable<UUID> ids);

    boolean existsByOrganizationIdAndCodeIgnoreCaseAndDeletedAtIsNull(UUID organizationId, String code);

    @Query(
            """
            select distinct r from Role r
            left join fetch r.permissions
            where r.deletedAt is null
              and r.system = true
              and r.organizationId = :organizationId
              and r.code <> 'SUPER_ADMIN'
            order by r.code
            """)
    List<Role> findSystemTenantRoles(@Param("organizationId") UUID organizationId);

    @Query(
            """
            select r from Role r
            left join fetch r.permissions
            where r.deletedAt is null
              and r.organizationId = :organizationId
              and r.code = :code
            """)
    Optional<Role> findByOrganizationIdAndCode(
            @Param("organizationId") UUID organizationId, @Param("code") String code);
}
