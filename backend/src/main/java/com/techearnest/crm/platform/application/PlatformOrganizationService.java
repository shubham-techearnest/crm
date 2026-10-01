package com.techearnest.crm.platform.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.AccessGuard;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.organization.domain.Organization;
import com.techearnest.crm.organization.domain.OrganizationRepository;
import com.techearnest.crm.organization.module.ModuleCatalog;
import com.techearnest.crm.organization.module.OrganizationModuleService;
import com.techearnest.crm.organization.module.OrganizationModuleService.ModuleState;
import com.techearnest.crm.platform.api.dto.PlatformOrganizationDtos.OrganizationAdminResponse;
import com.techearnest.crm.platform.api.dto.PlatformOrganizationDtos.PlatformOrganizationResponse;
import com.techearnest.crm.platform.api.dto.PlatformOrganizationDtos.ProvisionOrganizationRequest;
import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.region.domain.RegionRepository;
import com.techearnest.crm.role.domain.Role;
import com.techearnest.crm.role.domain.RoleRepository;
import com.techearnest.crm.user.domain.User;
import com.techearnest.crm.user.domain.UserRepository;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformOrganizationService {

    private final AccessGuard accessGuard;
    private final OrganizationRepository organizationRepository;
    private final RegionRepository regionRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final OrganizationModuleService organizationModuleService;
    private final JdbcTemplate jdbcTemplate;

    public PlatformOrganizationService(
            AccessGuard accessGuard,
            OrganizationRepository organizationRepository,
            RegionRepository regionRepository,
            RoleRepository roleRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService,
            OrganizationModuleService organizationModuleService,
            JdbcTemplate jdbcTemplate) {
        this.accessGuard = accessGuard;
        this.organizationRepository = organizationRepository;
        this.regionRepository = regionRepository;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.organizationModuleService = organizationModuleService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public PageResult list(String search, String status, Pageable pageable) {
        accessGuard.requirePlatform();
        Page<Organization> page =
                organizationRepository.searchActive(blankToNull(search), blankToNull(status), pageable);
        List<PlatformOrganizationResponse> data = page.getContent().stream()
                .map(org -> PlatformOrganizationResponse.from(
                        org,
                        userRepository.countByOrganizationIdAndDeletedAtIsNull(org.getId()),
                        null,
                        enabledModuleCount(org.getId())))
                .toList();
        return new PageResult(data, PaginationMeta.from(page));
    }

    private int enabledModuleCount(UUID organizationId) {
        return ModuleCatalog.MODULES.size() - organizationModuleService.disabledModules(organizationId).size();
    }

    @Transactional(readOnly = true)
    public PlatformOrganizationResponse get(UUID id) {
        accessGuard.requirePlatform();
        Organization org = organizationRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        long users = userRepository.countByOrganizationIdAndDeletedAtIsNull(id);
        long regions = regionRepository.findAllActiveByOrganization(id).size();
        return PlatformOrganizationResponse.from(org, users, regions, enabledModuleCount(id));
    }

    @Transactional
    public PlatformOrganizationResponse provision(ProvisionOrganizationRequest request) {
        CurrentUser actor = accessGuard.requirePlatform();
        String slug = request.slug().trim().toLowerCase();
        if (organizationRepository.existsBySlugIgnoreCaseAndDeletedAtIsNull(slug)) {
            throw new ConflictException("Organization slug already exists");
        }
        String adminEmail = request.adminEmail().trim().toLowerCase();

        Organization org = Organization.create(
                request.name().trim(),
                slug,
                request.legalName(),
                request.email(),
                request.phone(),
                request.website(),
                request.timezone(),
                request.locale(),
                request.currencyCode());
        organizationRepository.save(org);

        Region region = Region.create(
                org.getId(),
                null,
                request.defaultRegionName().trim(),
                request.defaultRegionCode().trim().toUpperCase());
        regionRepository.save(region);

        UUID templateOrgId = seedRolesFromTemplate(org.getId());

        Role orgAdminRole = roleRepository
                .findByOrganizationIdAndCode(org.getId(), "ORGANIZATION_ADMIN")
                .orElseThrow(() -> new BusinessException("ROLE_SEED_FAILED", "ORGANIZATION_ADMIN role was not seeded"));

        if (userRepository.existsActiveEmailInOrg(org.getId(), adminEmail)
                || userRepository.findByEmailForLogin(adminEmail).isPresent()) {
            throw new ConflictException("Admin email is already in use");
        }

        User admin = User.create(
                org.getId(),
                adminEmail,
                passwordEncoder.encode(request.adminPassword()),
                request.adminFirstName().trim(),
                request.adminLastName().trim(),
                null,
                region.getId(),
                null,
                null,
                null,
                null,
                "ACTIVE");
        admin.getRoles().add(orgAdminRole);
        admin.getAssignedRegions().add(region);
        userRepository.save(admin);

        List<String> modules = request.modules() == null
                ? ModuleCatalog.MODULES.stream().map(ModuleCatalog.ModuleDefinition::code).toList()
                : request.modules();
        organizationRepository.flush();
        organizationModuleService.replaceEnabled(org.getId(), modules, actor.userId());
        copyAclsFromTemplate(templateOrgId, org.getId(), actor.userId());

        auditService.record(org.getId(), actor.userId(), "CREATE", "ORGANIZATION", org.getId());
        auditService.record(org.getId(), actor.userId(), "CREATE", "USER", admin.getId());
        return PlatformOrganizationResponse.from(org, 1L, 1L);
    }

    public void requirePlatform() {
        accessGuard.requirePlatform();
    }

    @Transactional(readOnly = true)
    public List<ModuleState> modules(UUID id) {
        accessGuard.requirePlatform();
        requireOrganization(id);
        return organizationModuleService.list(id);
    }

    @Transactional
    public List<ModuleState> updateModules(UUID id, List<String> enabledModules) {
        CurrentUser actor = accessGuard.requirePlatform();
        requireOrganization(id);
        List<ModuleState> result = organizationModuleService.replaceEnabled(id, enabledModules, actor.userId());
        auditService.record(id, actor.userId(), "UPDATE", "ORGANIZATION", id);
        return result;
    }

    @Transactional(readOnly = true)
    public List<OrganizationAdminResponse> admins(UUID id) {
        accessGuard.requirePlatform();
        requireOrganization(id);
        return jdbcTemplate.query(
                """
                SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, u.status, u.last_login_at
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN roles r ON r.id = ur.role_id
                WHERE u.organization_id = ? AND u.deleted_at IS NULL AND r.code = 'ORGANIZATION_ADMIN'
                ORDER BY u.email
                """,
                (rs, rowNum) -> new OrganizationAdminResponse(
                        rs.getObject("id", UUID.class),
                        rs.getString("email"),
                        rs.getString("first_name"),
                        rs.getString("last_name"),
                        rs.getString("status"),
                        rs.getTimestamp("last_login_at") == null
                                ? null
                                : rs.getTimestamp("last_login_at").toInstant()),
                id);
    }

    private Organization requireOrganization(UUID id) {
        return organizationRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
    }

    @Transactional
    public PlatformOrganizationResponse setStatus(UUID id, String status) {
        CurrentUser actor = accessGuard.requirePlatform();
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!normalized.equals("ACTIVE") && !normalized.equals("SUSPENDED")) {
            throw new BusinessException("INVALID_STATUS", "Status must be ACTIVE or SUSPENDED");
        }
        Organization org = organizationRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        org.update(
                org.getName(),
                org.getLegalName(),
                org.getEmail(),
                org.getPhone(),
                org.getWebsite(),
                org.getTimezone(),
                org.getLocale(),
                org.getCurrencyCode(),
                normalized);
        auditService.record(org.getId(), actor.userId(), "UPDATE", "ORGANIZATION", org.getId());
        return get(id);
    }

    /** Gives the new organization's system roles the same table and field access as the template's. */
    private void copyAclsFromTemplate(UUID templateOrgId, UUID newOrganizationId, UUID actorId) {
        jdbcTemplate.update(
                """
                INSERT INTO sys_table_acl
                    (id, organization_id, role_id, table_id, can_create, can_read, can_update, can_delete, updated_by)
                SELECT gen_random_uuid(), ?, nr.id, a.table_id, a.can_create, a.can_read, a.can_update, a.can_delete, ?
                FROM sys_table_acl a
                JOIN roles tr ON tr.id = a.role_id
                JOIN roles nr ON nr.organization_id = ? AND nr.code = tr.code AND nr.deleted_at IS NULL
                JOIN sys_table t ON t.id = a.table_id AND t.organization_id IS NULL
                WHERE a.organization_id = ?
                ON CONFLICT (organization_id, role_id, table_id) DO NOTHING
                """,
                newOrganizationId, actorId, newOrganizationId, templateOrgId);
        jdbcTemplate.update(
                """
                INSERT INTO sys_field_acl (id, organization_id, role_id, field_id, access_level, updated_by)
                SELECT gen_random_uuid(), ?, nr.id, a.field_id, a.access_level, ?
                FROM sys_field_acl a
                JOIN roles tr ON tr.id = a.role_id
                JOIN roles nr ON nr.organization_id = ? AND nr.code = tr.code AND nr.deleted_at IS NULL
                JOIN sys_field f ON f.id = a.field_id AND f.organization_id IS NULL
                WHERE a.organization_id = ?
                ON CONFLICT (organization_id, role_id, field_id) DO NOTHING
                """,
                newOrganizationId, actorId, newOrganizationId, templateOrgId);
    }

    private UUID seedRolesFromTemplate(UUID newOrganizationId) {
        List<UUID> templates = organizationRepository.findTemplateOrganizationIds();
        if (templates.isEmpty()) {
            throw new BusinessException("ROLE_TEMPLATE_MISSING", "No template organization with system roles found");
        }
        UUID templateOrgId = templates.getFirst();
        List<Role> templateRoles = roleRepository.findSystemTenantRoles(templateOrgId);
        if (templateRoles.isEmpty()) {
            throw new BusinessException("ROLE_TEMPLATE_MISSING", "Template organization has no system roles");
        }
        for (Role template : templateRoles) {
            Role copy = Role.createSystem(
                    newOrganizationId, template.getCode(), template.getName(), template.getDataScope());
            copy.replacePermissions(new HashSet<>(template.getPermissions()));
            roleRepository.save(copy);
        }
        return templateOrgId;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<PlatformOrganizationResponse> data, PaginationMeta pagination) {}
}
