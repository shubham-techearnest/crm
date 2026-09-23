package com.techearnest.crm.timesheet.event;

import com.techearnest.crm.common.event.DomainEvent;
import java.util.UUID;

public class TimesheetSubmittedEvent extends DomainEvent {

    private final UUID timesheetId;
    private final UUID resourceId;

    public TimesheetSubmittedEvent(UUID organizationId, UUID timesheetId, UUID resourceId) {
        super(organizationId);
        this.timesheetId = timesheetId;
        this.resourceId = resourceId;
    }

    public UUID getTimesheetId() {
        return timesheetId;
    }

    public UUID getResourceId() {
        return resourceId;
    }
}
