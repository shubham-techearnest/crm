package com.techearnest.crm.auth.api.dto;

import com.techearnest.crm.common.security.CurrentUser;
import java.util.List;
import java.util.UUID;

public record MeResponse(
        UUID userId,
        UUID organizationId,
        String email,
        String displayName,
        String dataScope,
        List<UUID> regionIds,
        UUID departmentId,
        UUID teamId,
        UUID resourceId,
        List<String> permissions) {

    public static MeResponse from(CurrentUser user) {
        return new MeResponse(
                user.userId(),
                user.organizationId(),
                user.email(),
                user.displayName(),
                user.dataScope().name(),
                user.regionIdList(),
                user.departmentId(),
                user.teamId(),
                user.resourceId(),
                user.permissionList());
    }
}
