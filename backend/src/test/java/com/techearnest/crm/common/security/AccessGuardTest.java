package com.techearnest.crm.common.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class AccessGuardTest {

    private TeamVisibilityService teamVisibilityService;
    private AccessGuard accessGuard;
    private final UUID orgA = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private final UUID orgB = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private final UUID regionPune = UUID.fromString("22222222-2222-4222-8222-000000000011");
    private final UUID regionMumbai = UUID.fromString("22222222-2222-4222-8222-000000000012");
    private final UUID userId = UUID.fromString("77777777-7777-4777-8777-000000000003");

    @BeforeEach
    void setUp() {
        teamVisibilityService = mock(TeamVisibilityService.class);
        when(teamVisibilityService.visibleOwnerIds(any())).thenReturn(Set.of(userId));
        accessGuard = new AccessGuard(teamVisibilityService);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void regionalAdminCannotAccessAnotherRegion() {
        authenticate(regionalAdmin());
        SecuredRecord mumbaiLead = new TestRecord(orgA, regionMumbai, userId);
        assertThatThrownBy(() -> accessGuard.requireRecordAccess(mumbaiLead))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void missingPermissionIsForbidden() {
        authenticate(regionalAdmin());
        assertThatThrownBy(() -> accessGuard.requirePermission("ORG_CREATE"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void regionalAdminCanAccessAssignedRegion() {
        authenticate(regionalAdmin());
        accessGuard.requireRecordAccess(new TestRecord(orgA, regionPune, userId));
        accessGuard.requirePermission("LEAD_VIEW");
    }

    private CurrentUser regionalAdmin() {
        return new CurrentUser(
                userId,
                orgA,
                "pune.admin@example.com",
                "Rahul Deshmukh",
                DataScope.REGION,
                Set.of(regionPune),
                null,
                null,
                Set.of("LEAD_VIEW"),
                null);
    }

    private void authenticate(CurrentUser user) {
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    private record TestRecord(UUID organizationId, UUID regionId, UUID ownerId) implements SecuredRecord {
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
    }
}
