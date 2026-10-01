package com.techearnest.crm.common.security;

import com.techearnest.crm.auth.application.JwtService;
import com.techearnest.crm.common.logging.RequestContext;
import com.techearnest.crm.organization.module.OrganizationModuleService;
import com.techearnest.crm.portal.application.PortalAuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String TARGET_ORGANIZATION_HEADER = "X-Organization-Id";

    private static final String PORTAL_PATH_PREFIX = "/api/v1/portal/";
    private static final String PLATFORM_PATH_PREFIX = "/api/v1/platform/";
    private static final String AUTH_PATH_PREFIX = "/api/v1/auth/";

    /**
     * What a Super Admin may do inside a tenant when acting on it from the platform console:
     * configure access and customisation, and administer the org's users, independent of the
     * modules the organization itself is entitled to.
     */
    private static final Set<String> PLATFORM_TENANT_PERMISSIONS = Set.of(
            "ACL_VIEW", "ACL_MANAGE",
            "FIELD_ACL_VIEW", "FIELD_ACL_MANAGE",
            "METADATA_VIEW", "METADATA_MANAGE",
            "ROLE_VIEW", "ROLE_MANAGE",
            "USER_VIEW", "USER_MANAGE",
            "REGION_VIEW", "DEPARTMENT_VIEW", "TEAM_VIEW",
            "ORG_VIEW");

    private final JwtService jwtService;
    private final OrganizationModuleService organizationModuleService;

    public JwtAuthenticationFilter(JwtService jwtService, OrganizationModuleService organizationModuleService) {
        this.jwtService = jwtService;
        this.organizationModuleService = organizationModuleService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();
            if (!token.isEmpty()) {
                try {
                    String path = requestPath(request);
                    CurrentUser user = jwtService.parseAccessToken(token, expectedAudience(path));
                    user = applyOrganizationContext(user, request, path);
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    MDC.put(RequestContext.MDC_USER_ID, user.userId().toString());
                    if (user.organizationId() != null) {
                        MDC.put(RequestContext.MDC_ORGANIZATION_ID, user.organizationId().toString());
                    }
                } catch (JwtException | IllegalArgumentException ex) {
                    SecurityContextHolder.clearContext();
                }
            }
        }
        filterChain.doFilter(request, response);
    }

    private CurrentUser applyOrganizationContext(CurrentUser user, HttpServletRequest request, String path) {
        if (user.isPlatform()) {
            UUID target = targetOrganization(request, path);
            return target == null ? user : actingOnOrganization(user, target);
        }
        if (user.organizationId() == null) {
            return user;
        }
        Set<String> allowed = organizationModuleService.filterPermissions(user.organizationId(), user.permissions());
        if (allowed.size() == user.permissions().size()) {
            return user;
        }
        return withPermissions(user, user.organizationId(), user.dataScope(), allowed);
    }

    private static UUID targetOrganization(HttpServletRequest request, String path) {
        String value = request.getHeader(TARGET_ORGANIZATION_HEADER);
        if (value == null || value.isBlank() || path.startsWith(PLATFORM_PATH_PREFIX) || path.startsWith(AUTH_PATH_PREFIX)) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static CurrentUser actingOnOrganization(CurrentUser platformUser, UUID organizationId) {
        return withPermissions(platformUser, organizationId, DataScope.ORGANIZATION, PLATFORM_TENANT_PERMISSIONS);
    }

    private static CurrentUser withPermissions(
            CurrentUser user, UUID organizationId, DataScope scope, Set<String> permissions) {
        return new CurrentUser(
                user.userId(),
                organizationId,
                user.email(),
                user.displayName(),
                scope,
                user.regionIds(),
                user.departmentId(),
                user.teamId(),
                Set.copyOf(permissions),
                user.resourceId());
    }

    private static String requestPath(HttpServletRequest request) {
        return request.getRequestURI().substring(request.getContextPath().length());
    }

    private static String expectedAudience(String path) {
        return path.startsWith(PORTAL_PATH_PREFIX) ? PortalAuthService.AUDIENCE : JwtService.INTERNAL_AUDIENCE;
    }
}
