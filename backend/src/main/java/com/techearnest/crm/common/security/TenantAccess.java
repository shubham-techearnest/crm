package com.techearnest.crm.common.security;

import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class TenantAccess {

    private final AccessGuard accessGuard;
    private final TeamVisibilityService teamVisibilityService;

    public TenantAccess(AccessGuard accessGuard, TeamVisibilityService teamVisibilityService) {
        this.accessGuard = accessGuard;
        this.teamVisibilityService = teamVisibilityService;
    }

    public CurrentUser requirePermission(String permission) {
        accessGuard.requirePermission(permission);
        return accessGuard.requireUser();
    }

    public UUID resolveOrganizationId(UUID requestedOrganizationId) {
        CurrentUser user = accessGuard.requireUser();
        if (user.isPlatform()) {
            if (requestedOrganizationId == null) {
                throw new BusinessException("ORG_REQUIRED", "organizationId is required");
            }
            return requestedOrganizationId;
        }
        if (user.organizationId() == null) {
            throw new ForbiddenException("You do not have permission to perform this action");
        }
        if (requestedOrganizationId != null && !requestedOrganizationId.equals(user.organizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return user.organizationId();
    }

    public Collection<UUID> regionFilterOrNull() {
        CurrentUser user = accessGuard.requireUser();
        if (user.dataScope() == DataScope.PLATFORM || user.dataScope() == DataScope.ORGANIZATION) {
            return null;
        }
        if (user.dataScope() == DataScope.REGION) {
            Set<UUID> regionIds = user.regionIds();
            return regionIds.isEmpty() ? Set.of(UUID.fromString("00000000-0000-0000-0000-000000000000")) : regionIds;
        }
        return null;
    }

    /**
     * Single-owner filter for OWN scope, and for TEAM on resources/timesheets where
     * manager_id matching the current user is handled in the repository query.
     */
    public UUID ownerFilterOrNull() {
        CurrentUser user = accessGuard.requireUser();
        if (user.dataScope() == DataScope.OWN || user.dataScope() == DataScope.TEAM) {
            return user.userId();
        }
        return null;
    }

    /**
     * Multi-owner filter for CRM lists: OWN → self; TEAM → self + team + direct reports;
     * wider scopes → null (no owner restriction).
     */
    public Collection<UUID> ownerIdsFilterOrNull() {
        CurrentUser user = accessGuard.requireUser();
        if (user.dataScope() == DataScope.OWN) {
            return Set.of(user.userId());
        }
        if (user.dataScope() == DataScope.TEAM) {
            return teamVisibilityService.visibleOwnerIds(user);
        }
        return null;
    }

    public void assertRegionVisible(UUID regionId) {
        CurrentUser user = accessGuard.requireUser();
        if (user.dataScope() == DataScope.PLATFORM || user.dataScope() == DataScope.ORGANIZATION) {
            return;
        }
        if (user.dataScope() == DataScope.REGION
                && (regionId == null || !user.regionIds().contains(regionId))) {
            throw new ResourceNotFoundException("Resource not found");
        }
    }

    public void assertOrganizationVisible(UUID organizationId) {
        accessGuard.requireOrganization(organizationId);
    }

    public void assertRecordVisible(SecuredRecord record) {
        accessGuard.requireRecordAccess(record);
    }

    public CurrentUser currentUser() {
        return accessGuard.requireUser();
    }
}
