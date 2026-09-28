package com.techearnest.crm.portal.application;

import com.techearnest.crm.auth.application.JwtService;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.portal.api.dto.PortalAuthDtos.PortalLoginRequest;
import com.techearnest.crm.portal.api.dto.PortalAuthDtos.PortalTokenResponse;
import com.techearnest.crm.portal.domain.PortalUser;
import com.techearnest.crm.portal.domain.PortalUserRepository;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PortalAuthService {

    public static final String AUDIENCE = "PORTAL";

    private final PortalUserRepository portalUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TenantAccess tenantAccess;

    public PortalAuthService(
            PortalUserRepository portalUserRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            TenantAccess tenantAccess) {
        this.portalUserRepository = portalUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.tenantAccess = tenantAccess;
    }

    @Transactional
    public PortalTokenResponse login(PortalLoginRequest request) {
        PortalUser user = portalUserRepository
                .findByEmailForLogin(request.email())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));
        if (!"ACTIVE".equals(user.getStatus())
                || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }
        user.markLoggedIn();
        String displayName = ((user.getFirstName() == null ? "" : user.getFirstName()) + " "
                        + (user.getLastName() == null ? "" : user.getLastName()))
                .trim();
        CurrentUser principal = new CurrentUser(
                user.getId(),
                user.getOrganizationId(),
                user.getEmail(),
                displayName.isBlank() ? user.getEmail() : displayName,
                DataScope.OWN,
                Set.of(),
                user.getAccountId(),
                null,
                Set.of("PORTAL_ACCESS"),
                null);
        String token = jwtService.createPortalAccessToken(principal, AUDIENCE);
        return new PortalTokenResponse(token, jwtService.accessTokenTtlSeconds(), AUDIENCE);
    }

    public PortalSession requirePortalSession() {
        CurrentUser user = tenantAccess.currentUser();
        if (!user.hasPermission("PORTAL_ACCESS") || user.departmentId() == null) {
            throw new ForbiddenException("Portal access required");
        }
        return new PortalSession(user.organizationId(), user.departmentId(), user.userId());
    }

    public record PortalSession(UUID organizationId, UUID accountId, UUID portalUserId) {}
}
