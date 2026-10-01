package com.techearnest.crm.timesheet.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** A time entry joined with its timesheet's resource and status; read model for resource and project analytics. */
public record TimeEntryFact(
        UUID entryId,
        UUID resourceId,
        UUID projectId,
        UUID taskId,
        UUID allocationId,
        LocalDate workDate,
        BigDecimal hours,
        boolean billable,
        BigDecimal billingRate,
        BigDecimal costRate,
        String timesheetStatus) {

    public boolean approved() {
        return Timesheet.STATUS_APPROVED.equals(timesheetStatus);
    }
}
