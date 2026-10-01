package com.techearnest.crm.resource.domain;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ResourceRepository extends JpaRepository<Resource, UUID> {

    @Query(
            """
            select r from Resource r
            where r.userId = :userId and r.deletedAt is null
            """)
    Optional<Resource> findActiveByUserId(@Param("userId") UUID userId);

    @Query("select r from Resource r where r.id = :id and r.deletedAt is null")
    Optional<Resource> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select r from Resource r
            where r.organizationId = :organizationId
              and r.deletedAt is null
              and (:search is null
                   or lower(r.employeeCode) like lower(concat('%', cast(:search as string), '%'))
                   or lower(r.designation) like lower(concat('%', cast(:search as string), '%'))
                   or lower(r.fullName) like lower(concat('%', cast(:search as string), '%'))
                   or lower(r.email) like lower(concat('%', cast(:search as string), '%')))
              and (:regionIds is null or r.regionId in :regionIds)
              and (:ownerId is null or r.managerId = :ownerId or r.userId = :ownerId)
              and (:status is null or r.status = :status)
              and (:regionId is null or r.regionId = :regionId)
              and (:skillId is null
                   or exists (select 1 from ResourceSkill rs
                              where rs.id.resourceId = r.id and rs.id.skillId = :skillId))
            """)
    Page<Resource> search(
            @Param("organizationId") UUID organizationId,
            @Param("search") String search,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerId") UUID ownerId,
            @Param("status") String status,
            @Param("regionId") UUID regionId,
            @Param("skillId") UUID skillId,
            Pageable pageable);

    boolean existsByOrganizationIdAndEmployeeCodeAndDeletedAtIsNull(UUID organizationId, String employeeCode);

    @Query(
            """
            select case when (
                exists (select 1 from ResourceAllocation a where a.resourceId = :resourceId and a.deletedAt is null)
                or exists (select 1 from Timesheet t where t.resourceId = :resourceId and t.deletedAt is null)
            ) then true else false end
            from Resource r where r.id = :resourceId
            """)
    boolean hasWorkHistory(@Param("resourceId") UUID resourceId);

    /**
     * Every live resource of an organization within the caller's scope, for the resource board. Team / own scope
     * sees the people they manage, themselves, and everyone allocated to a project they manage.
     */
    @Query(
            """
            select r from Resource r
            where r.organizationId = :organizationId
              and r.deletedAt is null
              and (:regionIds is null or r.regionId in :regionIds)
              and (:ownerId is null
                   or r.managerId = :ownerId
                   or r.userId = :ownerId
                   or exists (
                        select 1 from ResourceAllocation a, Project p
                        where a.resourceId = r.id
                          and p.id = a.projectId
                          and a.deletedAt is null
                          and p.deletedAt is null
                          and p.projectManagerId = :ownerId))
            """)
    java.util.List<Resource> findForBoard(
            @Param("organizationId") UUID organizationId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerId") UUID ownerId);

    /** Resources without a login that can receive emailed timesheet links for the given week. */
    @Query(
            """
            select r from Resource r
            where r.deletedAt is null
              and r.userId is null
              and r.email is not null
              and r.status <> 'INACTIVE'
              and (r.engagementEndDate is null or r.engagementEndDate >= :weekStart)
              and exists (
                    select 1 from ResourceAllocation a
                    where a.resourceId = r.id
                      and a.deletedAt is null
                      and a.status in ('ACTIVE', 'PLANNED')
                      and a.startDate <= :weekEnd
                      and a.endDate >= :weekStart)
            """)
    java.util.List<Resource> findLinkRecipientsForWeek(
            @Param("weekStart") java.time.LocalDate weekStart, @Param("weekEnd") java.time.LocalDate weekEnd);
}
