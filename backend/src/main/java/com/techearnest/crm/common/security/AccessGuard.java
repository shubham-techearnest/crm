package com.techearnest.crm.common.security;

import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class AccessGuard {

    private final TeamVisibilityService teamVisibilityService;

    public AccessGuard(TeamVisibilityService teamVisibilityService) {
        this.teamVisibilityService = teamVisibilityService;
    }

    public CurrentUser requireUser() {
        return CurrentUserHolder.get()
                .orElseThrow(() -> new ForbiddenException("You do not have permission to perform this action"));
    }

    public void requirePermission(String permission) {
        CurrentUser user = requireUser();
        if (!user.hasPermission(permission)) {
            throw new ForbiddenException("You do not have permission to perform this action");
        }
    }

    /** Hard gate for /api/v1/platform/** — PLATFORM data scope only. */
    public CurrentUser requirePlatform() {
        CurrentUser user = requireUser();
        if (!user.isPlatform()) {
            throw new ForbiddenException("You do not have permission to perform this action");
        }
        return user;
    }

    public void requireOrganization(UUID organizationId) {
        CurrentUser user = requireUser();
        if (user.isPlatform()) {
            return;
        }
        if (organizationId == null || !Objects.equals(user.organizationId(), organizationId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
    }

    public void requireRecordAccess(SecuredRecord record) {
        requireOrganization(record.getOrganizationId());
        CurrentUser user = requireUser();
        switch (user.dataScope()) {
            case PLATFORM, ORGANIZATION -> {
                return;
            }
            case REGION -> {
                if (record.getRegionId() == null || !user.regionIds().contains(record.getRegionId())) {
                    throw new ResourceNotFoundException("Resource not found");
                }
            }
            case DEPARTMENT -> {
                boolean sameDept = record.getDepartmentId() != null
                        && Objects.equals(record.getDepartmentId(), user.departmentId());
                boolean own = isOwn(user, record);
                if (!sameDept && !own) {
                    throw new ResourceNotFoundException("Resource not found");
                }
            }
            case TEAM -> {
                boolean sameTeam =
                        record.getTeamId() != null && Objects.equals(record.getTeamId(), user.teamId());
                boolean own = isOwn(user, record);
                Set<UUID> visibleOwners = teamVisibilityService.visibleOwnerIds(user);
                boolean teamOwned =
                        record.getOwnerId() != null && visibleOwners.contains(record.getOwnerId());
                boolean teamAssigned = record.getAssignedUserId() != null
                        && visibleOwners.contains(record.getAssignedUserId());
                if (!sameTeam && !own && !teamOwned && !teamAssigned) {
                    throw new ResourceNotFoundException("Resource not found");
                }
            }
            case OWN -> {
                if (!isOwn(user, record)) {
                    throw new ResourceNotFoundException("Resource not found");
                }
            }
        }
    }

    private boolean isOwn(CurrentUser user, SecuredRecord record) {
        return Objects.equals(user.userId(), record.getOwnerId())
                || Objects.equals(user.userId(), record.getAssignedUserId());
    }
}
