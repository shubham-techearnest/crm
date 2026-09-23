package com.techearnest.crm.organization.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

    @Query(
            """
            select o from Organization o
            where o.deletedAt is null
              and (:search is null or lower(o.name) like lower(concat('%', cast(:search as string), '%'))
                   or lower(o.slug) like lower(concat('%', cast(:search as string), '%')))
              and (:status is null or o.status = :status)
            """)
    Page<Organization> searchActive(
            @Param("search") String search, @Param("status") String status, Pageable pageable);

    @Query("select o from Organization o where o.id = :id and o.deletedAt is null")
    Optional<Organization> findActiveById(@Param("id") UUID id);

    boolean existsBySlugIgnoreCaseAndDeletedAtIsNull(String slug);

    @Query("select count(o) from Organization o where o.deletedAt is null")
    long countNotDeleted();

    @Query("select count(o) from Organization o where o.deletedAt is null and o.status = :status")
    long countByStatusNotDeleted(@Param("status") String status);

    @Query(
            """
            select o.id from Organization o
            where o.deletedAt is null
              and o.status = 'ACTIVE'
              and exists (
                select 1 from Role r
                where r.organizationId = o.id
                  and r.deletedAt is null
                  and r.system = true
                  and r.code = 'ORGANIZATION_ADMIN'
              )
            order by o.createdAt asc
            """)
    List<UUID> findTemplateOrganizationIds();
}
