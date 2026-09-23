package com.techearnest.crm.timesheet.domain;

import com.techearnest.crm.common.security.SecuredRecord;
import com.techearnest.crm.resource.domain.Resource;
import java.util.UUID;

/** Adapts a timesheet + its resource for AccessGuard OWN/TEAM/REGION checks. */
public record TimesheetScope(
        UUID organizationId,
        UUID regionId,
        UUID ownerId,
        UUID assignedUserId,
        UUID departmentId,
        UUID teamId)
        implements SecuredRecord {

    public static TimesheetScope of(Timesheet timesheet, Resource resource) {
        return new TimesheetScope(
                timesheet.getOrganizationId(),
                timesheet.getRegionId(),
                resource.getManagerId(),
                resource.getUserId(),
                resource.getDepartmentId(),
                null);
    }

    @Override
    public UUID getOrganizationId() {
        return organizationId;
    }

    @Override
    public UUID getRegionId() {
        return regionId;
    }

    @Override
    public UUID getOwnerId() {
        return ownerId;
    }

    @Override
    public UUID getAssignedUserId() {
        return assignedUserId;
    }

    @Override
    public UUID getDepartmentId() {
        return departmentId;
    }

    @Override
    public UUID getTeamId() {
        return teamId;
    }
}
