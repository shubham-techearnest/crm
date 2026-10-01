package com.techearnest.crm.project.domain;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    @Query(
            """
            select p from Project p
            where p.organizationId = :organizationId
              and p.deletedAt is null
              and (:search is null
                   or lower(p.name) like lower(concat('%', cast(:search as string), '%'))
                   or lower(p.projectCode) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or p.regionId in :regionIds)
              and (:managerIds is null or p.projectManagerId in :managerIds)
              and (:status is null or p.status = :status)
              and (:accountId is null or p.accountId = :accountId)
              and (:projectManagerId is null or p.projectManagerId = :projectManagerId)
              and (:startFrom is null or p.startDate >= :startFrom)
              and (:endTo is null or p.endDate <= :endTo)
              and (:delayedOnly = false
                   or (p.endDate is not null
                       and p.endDate < CURRENT_DATE
                       and p.status not in ('COMPLETED', 'CANCELLED')))
            """)
    Page<Project> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("managerIds") Collection<UUID> managerIds,
            @Param("status") String status,
            @Param("accountId") UUID accountId,
            @Param("projectManagerId") UUID projectManagerId,
            @Param("startFrom") java.time.LocalDate startFrom,
            @Param("endTo") java.time.LocalDate endTo,
            @Param("delayedOnly") boolean delayedOnly,
            Pageable pageable);

    @Query("select p from Project p where p.id = :id and p.deletedAt is null")
    Optional<Project> findActiveById(@Param("id") UUID id);

    boolean existsByOrganizationIdAndProjectCode(UUID organizationId, String projectCode);

    boolean existsByOrganizationIdAndProjectManagerIdAndDeletedAtIsNull(UUID organizationId, UUID projectManagerId);

    Optional<Project> findByDealIdAndDeletedAtIsNull(UUID dealId);
}
