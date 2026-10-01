package com.techearnest.crm.auth.application;

import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.permission.domain.Permission;
import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.role.domain.Role;
import com.techearnest.crm.user.domain.User;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserFactory {

    private final ResourceRepository resourceRepository;

    public CurrentUserFactory(ResourceRepository resourceRepository) {
        this.resourceRepository = resourceRepository;
    }

    /**
     * Carries every role permission; JwtAuthenticationFilter removes those of modules the organization
     * is not entitled to on each request, so module changes apply without re-login.
     */
    public CurrentUser from(User user) {
        Set<String> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getCode)
                .collect(Collectors.toCollection(HashSet::new));
        DataScope scope = user.getRoles().stream()
                .map(Role::getDataScope)
                .min(Comparator.comparingInt(Enum::ordinal))
                .orElse(DataScope.OWN);
        Set<UUID> regionIds = new HashSet<>();
        if (user.getRegionId() != null) {
            regionIds.add(user.getRegionId());
        }
        user.getAssignedRegions().stream().map(Region::getId).forEach(regionIds::add);
        UUID resourceId = resourceRepository
                .findActiveByUserId(user.getId())
                .map(Resource::getId)
                .orElse(null);
        return new CurrentUser(
                user.getId(),
                user.getOrganizationId(),
                user.getEmail(),
                user.getDisplayName(),
                scope,
                regionIds,
                user.getDepartmentId(),
                user.getTeamId(),
                permissions,
                resourceId);
    }
}
