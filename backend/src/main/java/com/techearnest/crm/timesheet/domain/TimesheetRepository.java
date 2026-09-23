package com.techearnest.crm.timesheet.domain;

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

public interface TimesheetRepository extends JpaRepository<Timesheet, UUID> {

    @Query("select t from Timesheet t where t.id = :id and t.deletedAt is null")
    Optional<Timesheet> findActiveById(@Param("id") UUID id);

    boolean existsByResourceIdAndWeekStartDateAndDeletedAtIsNull(UUID resourceId, LocalDate weekStartDate);

    @Query(
            """
            select t from Timesheet t
            where t.organizationId = :organizationId
              and t.deletedAt is null
              and (:status is null or t.status = :status)
              and (:resourceId is null or t.resourceId = :resourceId)
              and (:weekStart is null or t.weekStartDate = :weekStart)
              and (:regionIds is null or t.regionId in :regionIds)
              and (:ownerId is null or exists (
                    select 1 from Resource r
                    where r.id = t.resourceId
                      and r.deletedAt is null
                      and (r.userId = :ownerId or r.managerId = :ownerId)
                  ))
              and (:billableOnly = false
                   or exists (
                        select 1 from TimeEntry e
                        where e.timesheetId = t.id
                          and e.deletedAt is null
                          and e.billable = true
                   ))
            """)
    Page<Timesheet> search(
            @Param("organizationId") UUID organizationId,
            @Param("status") String status,
            @Param("resourceId") UUID resourceId,
            @Param("weekStart") LocalDate weekStart,
            @Param("billableOnly") boolean billableOnly,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerId") UUID ownerId,
            Pageable pageable);

    @Query(
            """
            select t from Timesheet t
            where t.organizationId = :organizationId
              and t.deletedAt is null
              and (:regionIds is null or t.regionId in :regionIds)
              and (:ownerId is null or exists (
                    select 1 from Resource r
                    where r.id = t.resourceId
                      and r.deletedAt is null
                      and (r.userId = :ownerId or r.managerId = :ownerId)
                  ))
            order by t.weekStartDate desc
            """)
    List<Timesheet> findAllForExport(
            @Param("organizationId") UUID organizationId,
            @Param("regionIds") Collection<UUID> regionIds,
            @Param("ownerId") UUID ownerId);
}
