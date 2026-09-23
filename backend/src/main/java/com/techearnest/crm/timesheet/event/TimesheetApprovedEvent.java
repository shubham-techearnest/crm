package com.techearnest.crm.timesheet.event;

import com.techearnest.crm.common.event.DomainEvent;
import java.util.UUID;

public class TimesheetApprovedEvent extends DomainEvent {

    private final UUID timesheetId;
    private final UUID approvedBy;

    public TimesheetApprovedEvent(UUID organizationId, UUID timesheetId, UUID approvedBy) {
        super(organizationId);
        this.timesheetId = timesheetId;
        this.approvedBy = approvedBy;
    }

    public UUID getTimesheetId() {
        return timesheetId;
    }

    public UUID getApprovedBy() {
        return approvedBy;
    }
}
