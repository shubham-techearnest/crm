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

    public PlatformOrganizationService(
            AccessGuard accessGuard,
            OrganizationRepository organizationRepository,
            RegionRepository regionRepository,
            RoleRepository roleRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService) {
        this.accessGuard = accessGuard;
        this.organizationRepository = organizationRepository;
        this.regionRepository = regionRepository;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(String search, String status, Pageable pageable) {
        accessGuard.requirePlatform();
        Page<Organization> page =
                organizationRepository.searchActive(blankToNull(search), blankToNull(status), pageable);
        List<PlatformOrganizationResponse> data =
                page.getContent().stream().map(PlatformOrganizationResponse::from).toList();
        return new PageResult(data, PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public PlatformOrganizationResponse get(UUID id) {
        accessGuard.requirePlatform();
        Organization org = organizationRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        long users = userRepository.countByOrganizationIdAndDeletedAtIsNull(id);
        long regions = regionRepository.findAllActiveByOrganization(id).size();
        return PlatformOrganizationResponse.from(org, users, regions);
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

        seedRolesFromTemplate(org.getId());

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

        auditService.record(org.getId(), actor.userId(), "CREATE", "ORGANIZATION", org.getId());
        auditService.record(org.getId(), actor.userId(), "CREATE", "USER", admin.getId());
        return PlatformOrganizationResponse.from(org, 1L, 1L);
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

    private void seedRolesFromTemplate(UUID newOrganizationId) {
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
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<PlatformOrganizationResponse> data, PaginationMeta pagination) {}
}
