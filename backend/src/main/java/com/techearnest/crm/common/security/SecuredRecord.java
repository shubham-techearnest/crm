package com.techearnest.crm.common.security;

import java.util.UUID;

public interface SecuredRecord {

    UUID getOrganizationId();

    UUID getRegionId();

    UUID getOwnerId();

    default UUID getDepartmentId() {
        return null;
    }

    default UUID getTeamId() {
        return null;
    }

    default UUID getAssignedUserId() {
        return null;
    }
}
