package com.techearnest.crm.resource.domain;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ResourceAllocationRepository extends JpaRepository<ResourceAllocation, UUID> {

    @Query("select a from ResourceAllocation a where a.id = :id and a.deletedAt is null")
    Optional<ResourceAllocation> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select a from ResourceAllocation a
            join Resource r on r.id = a.resourceId
            where a.organizationId = :organizationId
              and a.deletedAt is null
              and r.deletedAt is null
              and (:resourceId is null or a.resourceId = :resourceId)
              and (:projectId is null or a.projectId = :projectId)
              and (:status is null or a.status = :status)
              and (:regionIds is null or r.regionId in :regionIds)
              and (:overlapOnly = false
                   or exists (
                        select 1 from ResourceAllocation o
                        where o.resourceId = a.resourceId
                          and o.id <> a.id
                          and o.deletedAt is null
                          and o.status in ('ACTIVE', 'PLANNED')
                          and a.status in ('ACTIVE', 'PLANNED')
                          and o.startDate <= a.endDate
                          and o.endDate >= a.startDate
                   ))
            """)
    Page<ResourceAllocation> search(
            @Param("organizationId") UUID organizationId,
            @Param("resourceId") UUID resourceId,
            @Param("projectId") UUID projectId,
            @Param("status") String status,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("overlapOnly") boolean overlapOnly,
            Pageable pageable);

    @Query(
            """
            select a from ResourceAllocation a
            where a.resourceId = :resourceId
              and a.deletedAt is null
              and a.status in ('ACTIVE', 'PLANNED')
              and a.startDate <= :periodEnd
              and a.endDate >= :periodStart
            """)
    List<ResourceAllocation> findOverlappingForUtilization(
            @Param("resourceId") UUID resourceId,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd);

    @Query(
            """
            select a from ResourceAllocation a
            where a.resourceId = :resourceId
              and a.deletedAt is null
              and a.status = 'ACTIVE'
              and a.startDate <= :asOf
              and a.endDate >= :asOf
            """)
    List<ResourceAllocation> findActiveOverlappingNow(
            @Param("resourceId") UUID resourceId, @Param("asOf") LocalDate asOf);

    @Query(
            """
            select a from ResourceAllocation a
            where a.resourceId = :resourceId
              and a.deletedAt is null
              and a.status in ('ACTIVE', 'PLANNED')
            order by a.startDate asc
            """)
    List<ResourceAllocation> findActiveOrPlannedByResource(@Param("resourceId") UUID resourceId);

    @Query(
            """
            select case when count(a) > 0 then true else false end from ResourceAllocation a
            where a.resourceId = :resourceId
              and a.projectId = :projectId
              and a.deletedAt is null
              and a.status in ('ACTIVE', 'PLANNED')
            """)
    boolean existsActiveOrPlannedForResourceAndProject(
            @Param("resourceId") UUID resourceId, @Param("projectId") UUID projectId);

    /** Every non-cancelled allocation (including history) of a resource on a project. */
    @Query(
            """
            select a from ResourceAllocation a
            where a.resourceId = :resourceId
              and a.projectId = :projectId
              and a.deletedAt is null
              and a.status <> 'CANCELLED'
            order by a.startDate asc
            """)
    List<ResourceAllocation> findHistoryForResourceAndProject(
            @Param("resourceId") UUID resourceId, @Param("projectId") UUID projectId);

    @Query(
            """
            select a from ResourceAllocation a
            where a.resourceId in :resourceIds
              and a.deletedAt is null
              and a.status <> 'CANCELLED'
              and a.startDate <= :periodEnd
              and a.endDate >= :periodStart
            """)
    List<ResourceAllocation> findForResourcesInWindow(
            @Param("resourceIds") Collection<UUID> resourceIds,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd);

    @Query(
            """
            select a from ResourceAllocation a
            where a.resourceId = :resourceId
              and a.deletedAt is null
            order by a.startDate desc
            """)
    List<ResourceAllocation> findAllByResource(@Param("resourceId") UUID resourceId);
}
