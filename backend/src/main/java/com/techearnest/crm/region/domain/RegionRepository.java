package com.techearnest.crm.region.domain;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RegionRepository extends JpaRepository<Region, UUID> {

    @Query(
            """
            select r from Region r
            where r.organizationId = :organizationId
              and r.deletedAt is null
              and (:search is null or lower(r.name) like lower(concat('%', cast(:search as string), '%'))
                   or lower(r.code) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or r.id in :regionIds)
            """)
    Page<Region> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            Pageable pageable);

    @Query("select r from Region r where r.id = :id and r.deletedAt is null")
    Optional<Region> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select r from Region r
            where r.organizationId = :organizationId and r.deletedAt is null
            order by r.name
            """)
    List<Region> findAllActiveByOrganization(@Param("organizationId") UUID organizationId);

    boolean existsByOrganizationIdAndCodeIgnoreCaseAndDeletedAtIsNull(UUID organizationId, String code);
}
