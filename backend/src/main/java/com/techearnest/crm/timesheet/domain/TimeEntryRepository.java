package com.techearnest.crm.timesheet.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TimeEntryRepository extends JpaRepository<TimeEntry, UUID> {

    @Query("select e from TimeEntry e where e.id = :id and e.deletedAt is null")
    Optional<TimeEntry> findActiveById(@Param("id") UUID id);

    @Query(
            """
            select e from TimeEntry e
            where e.timesheetId = :timesheetId and e.deletedAt is null
            order by e.workDate asc, e.createdAt asc
            """)
    List<TimeEntry> findActiveByTimesheetId(@Param("timesheetId") UUID timesheetId);

    @Query(
            """
            select e from TimeEntry e
            where e.timesheetId in :timesheetIds and e.deletedAt is null
            order by e.workDate asc
            """)
    List<TimeEntry> findActiveByTimesheetIdIn(@Param("timesheetIds") List<UUID> timesheetIds);

    @Query(
            """
            select coalesce(sum(e.hours), 0) from TimeEntry e, Timesheet t
            where e.timesheetId = t.id
              and e.projectId = :projectId
              and e.deletedAt is null
              and t.deletedAt is null
              and t.status = 'APPROVED'
            """)
    BigDecimal sumApprovedHoursByProject(@Param("projectId") UUID projectId);

    @Query(
            """
            select coalesce(sum(e.hours), 0) from TimeEntry e, Timesheet t
            where e.timesheetId = t.id
              and e.taskId = :taskId
              and e.deletedAt is null
              and t.deletedAt is null
              and t.status = 'APPROVED'
            """)
    BigDecimal sumApprovedHoursByTask(@Param("taskId") UUID taskId);

    @Query(
            """
            select e from TimeEntry e, Timesheet t
            where e.timesheetId = t.id
              and e.projectId = :projectId
              and e.deletedAt is null
              and t.deletedAt is null
            order by e.workDate asc
            """)
    List<TimeEntry> findActiveByProjectId(@Param("projectId") UUID projectId);

    @Query(
            """
            select e from TimeEntry e, Timesheet t
            where e.timesheetId = t.id
              and t.resourceId = :resourceId
              and e.workDate between :fromDate and :toDate
              and e.deletedAt is null
              and t.deletedAt is null
            order by e.workDate asc
            """)
    List<TimeEntry> findActiveByResourceBetween(
            @Param("resourceId") UUID resourceId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate);

    @Query(
            """
            select case when count(e) > 0 then true else false end from TimeEntry e, Timesheet t
            where e.timesheetId = t.id
              and t.resourceId = :resourceId
              and e.projectId = :projectId
              and e.workDate between :fromDate and :toDate
              and e.deletedAt is null
              and t.deletedAt is null
            """)
    boolean existsForResourceProjectBetween(
            @Param("resourceId") UUID resourceId,
            @Param("projectId") UUID projectId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate);

    /** Time entries with their timesheet's resource and status, for resource-board aggregation. */
    @Query(
            """
            select new com.techearnest.crm.timesheet.domain.TimeEntryFact(
                e.id, t.resourceId, e.projectId, e.taskId, e.allocationId, e.workDate, e.hours, e.billable,
                e.billingRate, e.costRate, t.status)
            from TimeEntry e, Timesheet t
            where e.timesheetId = t.id
              and e.organizationId = :organizationId
              and e.workDate between :fromDate and :toDate
              and e.deletedAt is null
              and t.deletedAt is null
              and (:resourceId is null or t.resourceId = :resourceId)
              and (:projectId is null or e.projectId = :projectId)
            """)
    List<TimeEntryFact> findFacts(
            @Param("organizationId") UUID organizationId,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            @Param("resourceId") UUID resourceId,
            @Param("projectId") UUID projectId);

    /** Approved time for one project across all dates, for project cost and revenue. */
    @Query(
            """
            select new com.techearnest.crm.timesheet.domain.TimeEntryFact(
                e.id, t.resourceId, e.projectId, e.taskId, e.allocationId, e.workDate, e.hours, e.billable,
                e.billingRate, e.costRate, t.status)
            from TimeEntry e, Timesheet t
            where e.timesheetId = t.id
              and e.projectId in :projectIds
              and e.deletedAt is null
              and t.deletedAt is null
              and t.status = 'APPROVED'
            """)
    List<TimeEntryFact> findApprovedFactsByProjects(@Param("projectIds") java.util.Collection<UUID> projectIds);

    @Query(
            """
            select e from TimeEntry e, Timesheet t
            where e.timesheetId = t.id
              and e.organizationId = :organizationId
              and e.deletedAt is null
              and t.deletedAt is null
              and t.status = 'APPROVED'
              and e.billable = true
              and (:projectId is null or e.projectId = :projectId)
              and not exists (
                  select 1 from InvoiceLine l
                  where l.timeEntryId = e.id and l.deletedAt is null
              )
            order by e.workDate asc
            """)
    List<TimeEntry> findUnbilledApprovedBillable(
            @Param("organizationId") UUID organizationId, @Param("projectId") UUID projectId);
}
