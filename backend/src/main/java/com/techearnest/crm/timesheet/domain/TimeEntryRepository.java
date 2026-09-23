package com.techearnest.crm.timesheet.domain;

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
