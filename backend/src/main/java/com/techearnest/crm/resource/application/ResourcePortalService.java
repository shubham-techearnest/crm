package com.techearnest.crm.resource.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.auth.application.TokenHash;
import com.techearnest.crm.auth.domain.UserInviteToken;
import com.techearnest.crm.auth.domain.UserInviteTokenRepository;
import com.techearnest.crm.common.config.SelfServiceProperties;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.mail.MailGateway;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.organization.domain.Organization;
import com.techearnest.crm.organization.domain.OrganizationRepository;
import com.techearnest.crm.permission.domain.PermissionRepository;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.AcceptInviteRequest;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.AcceptInviteResponse;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.InvitePreview;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.PortalAccessResponse;
import com.techearnest.crm.resource.api.dto.ResourcePortalDtos.PortalInviteRequest;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.role.domain.Role;
import com.techearnest.crm.role.domain.RoleRepository;
import com.techearnest.crm.user.domain.User;
import com.techearnest.crm.user.domain.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Limited self-service logins for contractors, freelancers and consultants: the login only carries the
 * External Contributor role (own work and own timesheets) and stops working after the engagement ends.
 */
@Service
public class ResourcePortalService {

    public static final String CONTRIBUTOR_ROLE = "EXTERNAL_CONTRIBUTOR";
    static final List<String> CONTRIBUTOR_PERMISSIONS = List.of(
            "NOTIFICATION_VIEW", "TIMESHEET_VIEW", "TIMESHEET_CREATE", "TIMESHEET_SUBMIT");

    private final ResourceRepository resourceRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserInviteTokenRepository inviteRepository;
    private final OrganizationRepository organizationRepository;
    private final PasswordEncoder passwordEncoder;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final MailGateway mailGateway;
    private final SelfServiceProperties properties;

    public ResourcePortalService(
            ResourceRepository resourceRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            PermissionRepository permissionRepository,
            UserInviteTokenRepository inviteRepository,
            OrganizationRepository organizationRepository,
            PasswordEncoder passwordEncoder,
            TenantAccess tenantAccess,
            AuditService auditService,
            MailGateway mailGateway,
            SelfServiceProperties properties) {
        this.resourceRepository = resourceRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.inviteRepository = inviteRepository;
        this.organizationRepository = organizationRepository;
        this.passwordEncoder = passwordEncoder;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.mailGateway = mailGateway;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public PortalAccessResponse status(UUID resourceId) {
        tenantAccess.requirePermission("RESOURCE_VIEW");
        Resource resource = requireVisibleResource(resourceId);
        User user = resource.getUserId() == null ? null : userRepository.findById(resource.getUserId()).orElse(null);
        return response(resource, user, null, null, false);
    }

    /** Creates (or re-sends) a contributor login for a resource and emails a set-password link. */
    @Transactional
    public PortalAccessResponse invite(UUID resourceId, PortalInviteRequest request) {
        CurrentUser actor = tenantAccess.requirePermission("RESOURCE_PORTAL_INVITE");
        Resource resource = requireVisibleResource(resourceId);
        if (!resource.isExternal()) {
            throw new BusinessException(
                    "INTERNAL_EMPLOYEE", "Employees sign in with their own user account; portal access is for external resources");
        }
        Instant accessExpiresAt = endOfDay(
                request.accessExpiresOn() != null ? request.accessExpiresOn() : resource.getEngagementEndDate());
        if (accessExpiresAt != null && !accessExpiresAt.isAfter(Instant.now())) {
            throw new BusinessException("INVALID_EXPIRY", "Access end date must be in the future");
        }

        User user;
        if (resource.getUserId() != null) {
            user = userRepository
                    .findActiveDetailsById(resource.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            if (!isContributorOnly(user)) {
                throw new BusinessException(
                        "HAS_LOGIN", "This resource already has an internal login; manage it from Users");
            }
            user.reinvite();
        } else {
            String email = firstNonBlank(request.email(), resource.getEmail());
            if (email == null) {
                throw new BusinessException("EMAIL_REQUIRED", "Add an email to the resource before inviting them");
            }
            email = email.trim().toLowerCase(Locale.ROOT);
            if (userRepository.existsActiveEmailInOrg(resource.getOrganizationId(), email)) {
                throw new ConflictException(
                        "A user with this email already exists; link that user to the resource instead");
            }
            String[] names = splitName(resource.getFullName(), email);
            user = User.create(
                    resource.getOrganizationId(),
                    email,
                    passwordEncoder.encode(TokenHash.newOpaqueToken()),
                    names[0],
                    names[1],
                    resource.getPhone(),
                    resource.getRegionId(),
                    null,
                    resource.getDepartmentId(),
                    null,
                    resource.getManagerId(),
                    "INVITED");
            user.replaceRoles(Set.of(contributorRole(resource.getOrganizationId())));
            userRepository.save(user);
            resource.linkUser(user.getId());
            if (resource.getEmail() == null) {
                resource.updateContact(null, email, null, null);
            }
        }
        user.setAccessExpiresAt(accessExpiresAt);

        inviteRepository.findOpenByUserId(user.getId()).forEach(UserInviteToken::revoke);
        String raw = TokenHash.newOpaqueToken();
        UserInviteToken token = UserInviteToken.issue(
                user.getId(), TokenHash.sha256(raw), Instant.now().plus(properties.getInviteTtl()), actor.userId());
        inviteRepository.save(token);
        String url = properties.link("/accept-invite/" + raw);

        String orgName = organizationName(resource.getOrganizationId());
        mailGateway.send(
                user.getEmail(),
                "You're invited to " + (orgName != null ? orgName : "TechEarnest CRM"),
                "Hi " + user.getFirstName() + ",\n\nYou now have a login to see your assigned projects and tasks and "
                        + "fill in your timesheets.\n\nChoose your password here:\n" + url
                        + "\n\nThe link expires on " + token.getExpiresAt() + "."
                        + (accessExpiresAt != null ? "\nYour access runs until " + accessExpiresAt + "." : ""));
        auditService.record(resource.getOrganizationId(), actor.userId(), "PORTAL_INVITE", "RESOURCE", resource.getId());
        return response(resource, user, url, token.getExpiresAt(), true);
    }

    @Transactional
    public PortalAccessResponse updateAccess(UUID resourceId, LocalDate accessExpiresOn) {
        CurrentUser actor = tenantAccess.requirePermission("RESOURCE_PORTAL_INVITE");
        Resource resource = requireVisibleResource(resourceId);
        User user = requireContributor(resource);
        Instant expiresAt = endOfDay(accessExpiresOn);
        user.setAccessExpiresAt(expiresAt);
        auditService.record(resource.getOrganizationId(), actor.userId(), "PORTAL_ACCESS", "RESOURCE", resource.getId());
        return response(resource, user, null, null, false);
    }

    @Transactional
    public PortalAccessResponse revoke(UUID resourceId) {
        CurrentUser actor = tenantAccess.requirePermission("RESOURCE_PORTAL_INVITE");
        Resource resource = requireVisibleResource(resourceId);
        User user = requireContributor(resource);
        user.deactivate();
        inviteRepository.findOpenByUserId(user.getId()).forEach(UserInviteToken::revoke);
        auditService.record(resource.getOrganizationId(), actor.userId(), "PORTAL_REVOKE", "RESOURCE", resource.getId());
        return response(resource, user, null, null, false);
    }

    /** Keeps a contributor's login expiry in line with the resource's engagement end date. */
    @Transactional
    public void syncEngagementEnd(Resource resource) {
        if (resource.getUserId() == null || resource.getEngagementEndDate() == null) {
            return;
        }
        userRepository.findActiveDetailsById(resource.getUserId())
                .filter(ResourcePortalService::isContributorOnly)
                .ifPresent(user -> user.setAccessExpiresAt(endOfDay(resource.getEngagementEndDate())));
    }

    @Transactional(readOnly = true)
    public InvitePreview preview(String rawToken) {
        UserInviteToken token = requireUsableInvite(rawToken);
        User user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("This invitation is invalid or has expired"));
        return new InvitePreview(
                user.getEmail(), user.getDisplayName(), organizationName(user.getOrganizationId()), token.getExpiresAt());
    }

    @Transactional
    public AcceptInviteResponse accept(String rawToken, AcceptInviteRequest request) {
        UserInviteToken token = requireUsableInvite(rawToken);
        User user = userRepository.findById(token.getUserId())
                .filter(found -> found.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("This invitation is invalid or has expired"));
        if (!"INVITED".equals(user.getStatus()) && !"ACTIVE".equals(user.getStatus())) {
            throw new BusinessException("INVITE_REVOKED", "This invitation was withdrawn");
        }
        user.acceptInvite(passwordEncoder.encode(request.password()));
        token.accept();
        auditService.record(user.getOrganizationId(), user.getId(), "ACCEPT_INVITE", "USER", user.getId());
        return new AcceptInviteResponse(user.getEmail());
    }

    public static String loginStatus(User user, Instant now) {
        if (user == null || user.getDeletedAt() != null) {
            return "NONE";
        }
        return switch (user.getStatus()) {
            case "INVITED" -> "INVITED";
            case "ACTIVE" -> user.isAccessExpired(now) ? "EXPIRED" : "ACTIVE";
            default -> "DEACTIVATED";
        };
    }

    private PortalAccessResponse response(
            Resource resource, User user, String inviteUrl, Instant inviteExpiresAt, boolean emailed) {
        return new PortalAccessResponse(
                resource.getId(),
                user == null ? null : user.getId(),
                user == null ? resource.getEmail() : user.getEmail(),
                loginStatus(user, Instant.now()),
                user == null ? null : user.getAccessExpiresAt(),
                inviteUrl,
                inviteExpiresAt,
                emailed,
                user == null || isContributorOnly(user));
    }

    private Role contributorRole(UUID organizationId) {
        return roleRepository.findByOrganizationIdAndCode(organizationId, CONTRIBUTOR_ROLE).orElseGet(() -> {
            Role role = Role.createSystem(organizationId, CONTRIBUTOR_ROLE, "External Contributor", DataScope.OWN);
            role.replacePermissions(new HashSet<>(permissionRepository.findByCodeIn(CONTRIBUTOR_PERMISSIONS)));
            return roleRepository.save(role);
        });
    }

    static boolean isContributorOnly(User user) {
        return !user.getRoles().isEmpty()
                && user.getRoles().stream().allMatch(role -> CONTRIBUTOR_ROLE.equals(role.getCode()));
    }

    private User requireContributor(Resource resource) {
        if (resource.getUserId() == null) {
            throw new BusinessException("NO_LOGIN", "This resource has no login");
        }
        User user = userRepository
                .findActiveDetailsById(resource.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!isContributorOnly(user)) {
            throw new BusinessException("HAS_LOGIN", "This resource has an internal login; manage it from Users");
        }
        return user;
    }

    private Resource requireVisibleResource(UUID resourceId) {
        Resource resource = resourceRepository
                .findActiveById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(resource);
        return resource;
    }

    private UserInviteToken requireUsableInvite(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 128) {
            throw new ResourceNotFoundException("This invitation is invalid or has expired");
        }
        UserInviteToken token = inviteRepository
                .findByTokenHash(TokenHash.sha256(rawToken.trim()))
                .orElseThrow(() -> new ResourceNotFoundException("This invitation is invalid or has expired"));
        if (!token.isUsable(Instant.now())) {
            throw new ResourceNotFoundException("This invitation is invalid or has expired");
        }
        return token;
    }

    private String organizationName(UUID organizationId) {
        return organizationId == null
                ? null
                : organizationRepository.findActiveById(organizationId).map(Organization::getName).orElse(null);
    }

    /** Access runs through the whole last day. */
    private static Instant endOfDay(LocalDate date) {
        return date == null ? null : date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private static String[] splitName(String fullName, String email) {
        String source = fullName != null && !fullName.isBlank() ? fullName.trim() : email.substring(0, email.indexOf('@'));
        int space = source.indexOf(' ');
        if (space < 0) {
            return new String[] {truncate(source), ""};
        }
        return new String[] {truncate(source.substring(0, space)), truncate(source.substring(space + 1).trim())};
    }

    private static String truncate(String value) {
        return value.length() > 100 ? value.substring(0, 100) : value;
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second != null && !second.isBlank() ? second : null;
    }
}
