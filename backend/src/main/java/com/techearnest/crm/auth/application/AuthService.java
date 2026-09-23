package com.techearnest.crm.auth.application;

import com.techearnest.crm.auth.api.dto.LoginRequest;
import com.techearnest.crm.auth.api.dto.MeResponse;
import com.techearnest.crm.auth.api.dto.TokenResponse;
import com.techearnest.crm.auth.domain.RefreshToken;
import com.techearnest.crm.auth.domain.RefreshTokenRepository;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.config.SecurityProperties;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.organization.domain.Organization;
import com.techearnest.crm.organization.domain.OrganizationRepository;
import com.techearnest.crm.user.domain.User;
import com.techearnest.crm.user.domain.UserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.Arrays;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CurrentUserFactory currentUserFactory;
    private final LoginRateLimiter loginRateLimiter;
    private final AuditService auditService;
    private final SecurityProperties securityProperties;

    public AuthService(
            UserRepository userRepository,
            OrganizationRepository organizationRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            CurrentUserFactory currentUserFactory,
            LoginRateLimiter loginRateLimiter,
            AuditService auditService,
            SecurityProperties securityProperties) {
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.currentUserFactory = currentUserFactory;
        this.loginRateLimiter = loginRateLimiter;
        this.auditService = auditService;
        this.securityProperties = securityProperties;
    }

    @Transactional
    public TokenResponse login(LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        loginRateLimiter.check(request.email());
        User user = userRepository
                .findByEmailForLogin(request.email())
                .orElse(null);
        if (user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            loginRateLimiter.recordFailure(request.email());
            throw new BadCredentialsException("Invalid email or password");
        }
        if (!"ACTIVE".equals(user.getStatus())) {
            throw new ForbiddenException("Account is not active");
        }
        assertOrganizationAllowsLogin(user);
        user = loadRegions(user);
        user.markLoggedIn();
        loginRateLimiter.clear(request.email());
        CurrentUser currentUser = currentUserFactory.from(user);
        issueRefreshCookie(currentUser.userId(), httpRequest, response);
        auditService.record(user.getOrganizationId(), user.getId(), "LOGIN", "USER", user.getId());
        return tokensFor(currentUser);
    }

    @Transactional
    public TokenResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        String raw = readRefreshCookie(request);
        if (raw == null) {
            throw new BadCredentialsException("Refresh token is missing");
        }
        RefreshToken stored = refreshTokenRepository
                .findByTokenHash(TokenHash.sha256(raw))
                .orElseThrow(() -> new BadCredentialsException("Refresh token is invalid"));
        if (!stored.isUsable()) {
            throw new BadCredentialsException("Refresh token is invalid");
        }
        stored.revoke();
        User user = userRepository
                .findById(stored.getUserId())
                .filter(found -> found.getStatus().equals("ACTIVE") && found.getDeletedAt() == null)
                .orElseThrow(() -> new BadCredentialsException("Refresh token is invalid"));
        assertOrganizationAllowsLogin(user);
        user = userRepository.findByEmailForLogin(user.getEmail()).orElse(user);
        user = loadRegions(user);
        CurrentUser currentUser = currentUserFactory.from(user);
        issueRefreshCookie(currentUser.userId(), request, response);
        return tokensFor(currentUser);
    }

    @Transactional
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        String raw = readRefreshCookie(request);
        if (raw != null) {
            refreshTokenRepository.findByTokenHash(TokenHash.sha256(raw)).ifPresent(token -> {
                token.revoke();
                auditService.record(null, token.getUserId(), "LOGOUT", "USER", token.getUserId());
            });
        }
        clearRefreshCookie(request, response);
    }

    @Transactional(readOnly = true)
    public MeResponse me(CurrentUser currentUser) {
        return MeResponse.from(currentUser);
    }

    private User loadRegions(User user) {
        return userRepository.findWithRegions(user.getId()).orElse(user);
    }

    private void assertOrganizationAllowsLogin(User user) {
        if (user.getOrganizationId() == null) {
            return;
        }
        Organization org = organizationRepository
                .findActiveById(user.getOrganizationId())
                .orElseThrow(() -> new ForbiddenException("Organization is not available"));
        if ("SUSPENDED".equalsIgnoreCase(org.getStatus())) {
            throw new ForbiddenException("Organization is suspended. Contact TechEarnest support.");
        }
        if (!"ACTIVE".equalsIgnoreCase(org.getStatus())) {
            throw new ForbiddenException("Organization is not active");
        }
    }

    private TokenResponse tokensFor(CurrentUser currentUser) {
        return new TokenResponse(
                jwtService.createAccessToken(currentUser),
                jwtService.accessTokenTtlSeconds(),
                "Bearer");
    }

    private void issueRefreshCookie(UUID userId, HttpServletRequest request, HttpServletResponse response) {
        String raw = TokenHash.newOpaqueToken();
        Instant expiresAt = Instant.now().plus(securityProperties.getRefreshTokenTtl());
        refreshTokenRepository.save(
                RefreshToken.issue(userId, TokenHash.sha256(raw), expiresAt, request.getHeader(HttpHeaders.USER_AGENT)));
        writeCookie(request, response, raw, securityProperties.getRefreshTokenTtl().toSeconds());
    }

    private String readRefreshCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        return Arrays.stream(cookies)
                .filter(cookie -> securityProperties.getRefreshCookieName().equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }

    private void clearRefreshCookie(HttpServletRequest request, HttpServletResponse response) {
        writeCookie(request, response, "", 0);
    }

    private void writeCookie(HttpServletRequest request, HttpServletResponse response, String value, long maxAge) {
        ResponseCookie cookie = ResponseCookie.from(securityProperties.getRefreshCookieName(), value)
                .httpOnly(true)
                .secure(request.isSecure())
                .sameSite("Lax")
                .path("/api/v1/auth")
                .maxAge(maxAge)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
