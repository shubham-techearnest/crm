package com.techearnest.crm.timesheet.event;

import com.techearnest.crm.common.event.DomainEvent;
import java.util.UUID;

public class TimesheetRejectedEvent extends DomainEvent {

    private final UUID timesheetId;
    private final UUID rejectedBy;
    private final String reason;

    public TimesheetRejectedEvent(UUID organizationId, UUID timesheetId, UUID rejectedBy, String reason) {
        super(organizationId);
        this.timesheetId = timesheetId;
        this.rejectedBy = rejectedBy;
        this.reason = reason;
    }

    public UUID getTimesheetId() {
        return timesheetId;
    }

    public UUID getRejectedBy() {
        return rejectedBy;
    }

    public String getReason() {
        return reason;
    }
}
