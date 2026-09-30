package com.techearnest.crm.resource.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.application.FieldAclEvaluator;
import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.region.domain.RegionRepository;
import com.techearnest.crm.resource.api.dto.ResourceDtos.CreateResourceRequest;
import com.techearnest.crm.department.domain.Department;
import com.techearnest.crm.department.domain.DepartmentRepository;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ReplaceSkillsRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.LoginInfo;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ResourceNames;
import com.techearnest.crm.user.domain.User;
import com.techearnest.crm.user.domain.UserRepository;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ResourceResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ResourceSkillItem;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ResourceSkillResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UpdateResourceRequest;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocation;
import com.techearnest.crm.resource.domain.ResourceAllocationRepository;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.resource.domain.ResourceSkill;
import com.techearnest.crm.resource.domain.ResourceSkillRepository;
import com.techearnest.crm.resource.domain.Skill;
import com.techearnest.crm.resource.domain.SkillRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ResourceService {

    private final ResourceRepository resourceRepository;
    private final ResourceSkillRepository resourceSkillRepository;
    private final ResourceAllocationRepository allocationRepository;
    private final SkillRepository skillRepository;
    private final RegionRepository regionRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final FieldAclEvaluator fieldAclEvaluator;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final ResourcePortalService portalService;
    private final ResourceCodeGenerator codeGenerator;

    public ResourceService(
            ResourceRepository resourceRepository,
            ResourceSkillRepository resourceSkillRepository,
            ResourceAllocationRepository allocationRepository,
            SkillRepository skillRepository,
            RegionRepository regionRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            FieldAclEvaluator fieldAclEvaluator,
            UserRepository userRepository,
            DepartmentRepository departmentRepository,
            ResourcePortalService portalService,
            ResourceCodeGenerator codeGenerator) {
        this.portalService = portalService;
        this.codeGenerator = codeGenerator;
        this.userRepository = userRepository;
        this.departmentRepository = departmentRepository;
        this.resourceRepository = resourceRepository;
        this.resourceSkillRepository = resourceSkillRepository;
        this.allocationRepository = allocationRepository;
        this.skillRepository = skillRepository;
        this.regionRepository = regionRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.fieldAclEvaluator = fieldAclEvaluator;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String search,
            String status,
            UUID regionId,
            UUID skillId,
            Pageable pageable) {
        tenantAccess.requirePermission("RESOURCE_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        UUID ownerId = tenantAccess.ownerFilterOrNull();
        Page<Resource> page = resourceRepository.search(
                orgId,
                blankToNull(search),
                regionIds,
                ownerId,
                blankToNull(status),
                regionId,
                skillId,
                pageable);
        boolean includeCostRate = canViewCostRate();
        boolean includeBillingRate = canViewBillingRate();
        ResourceNames names = namesFor(orgId, page.getContent());
        List<ResourceResponse> data = page.getContent().stream()
                .map(r -> ResourceResponse.from(r, includeCostRate, includeBillingRate, names))
                .toList();
        return new PageResult(data, PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public ResourceResponse get(UUID id) {
        tenantAccess.requirePermission("RESOURCE_VIEW");
        return toResponse(requireVisibleResource(id));
    }

    @Transactional
    public ResourceResponse create(CreateResourceRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_MANAGE");
        requireRateWrite("costRate", request.costRate());
        requireRateWrite("billingRate", request.billingRate());
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        Region region = requireRegionInOrg(request.regionId(), orgId);
        tenantAccess.assertRegionVisible(region.getId());

        String resourceType = normalizeType(request.resourceType());
        assertPersonDetails(resourceType, orgId, request.userId(), request.fullName(), null);

        String employeeCode = blankToNull(request.employeeCode());
        if (employeeCode != null
                && resourceRepository.existsByOrganizationIdAndEmployeeCodeAndDeletedAtIsNull(orgId, employeeCode)) {
            throw new ConflictException("Employee code already exists");
        }
        if (employeeCode == null) {
            employeeCode = codeGenerator.next(orgId, resourceType);
        }

        Resource resource = Resource.create(
                orgId,
                region.getId(),
                request.userId(),
                employeeCode,
                blankToNull(request.designation()),
                request.departmentId(),
                request.managerId(),
                resourceType,
                request.joiningDate(),
                request.costRate(),
                request.billingRate(),
                request.capacityHoursPerWeek(),
                blankToNull(request.status()));
        resource.updateContact(request.fullName(), request.email(), request.phone(), request.engagementEndDate());
        resourceRepository.save(resource);
        refreshDerivedStatus(resource);
        auditService.record(orgId, user.userId(), "CREATE", "RESOURCE", resource.getId());
        return toResponse(resource);
    }

    @Transactional
    public ResourceResponse update(UUID id, UpdateResourceRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_MANAGE");
        requireRateWrite("costRate", request.costRate());
        requireRateWrite("billingRate", request.billingRate());
        Resource resource = requireVisibleResource(id);
        if (request.regionId() != null) {
            Region region = requireRegionInOrg(request.regionId(), resource.getOrganizationId());
            tenantAccess.assertRegionVisible(region.getId());
        }
        if (request.employeeCode() != null
                && !request.employeeCode().isBlank()
                && !request.employeeCode().equals(resource.getEmployeeCode())
                && resourceRepository.existsByOrganizationIdAndEmployeeCodeAndDeletedAtIsNull(
                        resource.getOrganizationId(), request.employeeCode().trim())) {
            throw new ConflictException("Employee code already exists");
        }
        String resourceType = request.resourceType() == null || request.resourceType().isBlank()
                ? resource.getResourceType()
                : normalizeType(request.resourceType());
        UUID userId = request.userId() != null ? request.userId() : resource.getUserId();
        String fullName = request.fullName() != null ? request.fullName() : resource.getFullName();
        if (!resourceType.equals(resource.getResourceType()) || request.userId() != null) {
            assertPersonDetails(resourceType, resource.getOrganizationId(), userId, fullName, resource.getId());
        }
        String employeeCode = request.employeeCode() != null ? request.employeeCode().trim() : null;
        if (employeeCode != null && employeeCode.isEmpty()) {
            employeeCode = resource.getEmployeeCode() != null
                    ? resource.getEmployeeCode()
                    : codeGenerator.next(resource.getOrganizationId(), resourceType);
        }
        resource.update(
                request.regionId(),
                request.userId(),
                employeeCode,
                request.designation(),
                request.departmentId(),
                request.managerId(),
                resourceType,
                request.joiningDate(),
                request.costRate(),
                request.billingRate(),
                request.capacityHoursPerWeek(),
                blankToNull(request.status()));
        resource.updateContact(request.fullName(), request.email(), request.phone(), request.engagementEndDate());
        if (Boolean.TRUE.equals(request.clearEngagementEndDate())) {
            resource.clearEngagementEndDate();
        }
        if (request.engagementEndDate() != null) {
            portalService.syncEngagementEnd(resource);
        }
        if (request.status() == null || request.status().isBlank()) {
            refreshDerivedStatus(resource);
        }
        auditService.record(resource.getOrganizationId(), user.userId(), "UPDATE", "RESOURCE", resource.getId());
        return toResponse(resource);
    }

    private ResourceResponse toResponse(Resource resource) {
        return ResourceResponse.from(
                resource, canViewCostRate(), canViewBillingRate(),
                namesFor(resource.getOrganizationId(), List.of(resource)));
    }

    private ResourceNames namesFor(UUID organizationId, List<Resource> resources) {
        Set<UUID> userIds = new HashSet<>();
        Set<UUID> departmentIds = new HashSet<>();
        for (Resource resource : resources) {
            if (resource.getUserId() != null) userIds.add(resource.getUserId());
            if (resource.getManagerId() != null) userIds.add(resource.getManagerId());
            if (resource.getDepartmentId() != null) departmentIds.add(resource.getDepartmentId());
        }
        Map<UUID, String> users = new HashMap<>();
        Map<UUID, LoginInfo> logins = new HashMap<>();
        Instant now = Instant.now();
        if (!userIds.isEmpty()) {
            for (User user : userRepository.findAllById(userIds)) {
                if (organizationId.equals(user.getOrganizationId())) {
                    users.put(user.getId(), user.getDisplayName());
                    logins.put(user.getId(), new LoginInfo(
                            ResourcePortalService.loginStatus(user, now), user.getAccessExpiresAt()));
                }
            }
        }
        Map<UUID, String> departments = new HashMap<>();
        if (!departmentIds.isEmpty()) {
            for (Department department : departmentRepository.findAllById(departmentIds)) {
                if (organizationId.equals(department.getOrganizationId())) {
                    departments.put(department.getId(), department.getName());
                }
            }
        }
        return new ResourceNames(users, departments, logins);
    }

    @Transactional
    public void softDelete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_MANAGE");
        Resource resource = requireVisibleResource(id);
        resource.markDeleted();
        auditService.record(resource.getOrganizationId(), user.userId(), "DELETE", "RESOURCE", resource.getId());
    }

    @Transactional
    public List<ResourceSkillResponse> putSkills(UUID resourceId, ReplaceSkillsRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_MANAGE");
        Resource resource = requireVisibleResource(resourceId);
        resourceSkillRepository.deleteByResourceId(resourceId);
        resourceSkillRepository.flush();
        for (ResourceSkillItem item : request.skills()) {
            Skill skill = skillRepository
                    .findActiveById(item.skillId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            if (!skill.getOrganizationId().equals(resource.getOrganizationId())) {
                throw new ResourceNotFoundException("Resource not found");
            }
            resourceSkillRepository.save(ResourceSkill.create(
                    resourceId, item.skillId(), item.proficiency().trim(), item.yearsOfExperience()));
        }
        auditService.record(resource.getOrganizationId(), user.userId(), "UPDATE", "RESOURCE_SKILLS", resourceId);
        return resourceSkillRepository.findByIdResourceId(resourceId).stream()
                .map(ResourceSkillResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ResourceSkillResponse> listSkills(UUID resourceId) {
        tenantAccess.requirePermission("RESOURCE_VIEW");
        requireVisibleResource(resourceId);
        return resourceSkillRepository.findByIdResourceId(resourceId).stream()
                .map(ResourceSkillResponse::from)
                .toList();
    }

    public Resource requireVisibleResource(UUID id) {
        Resource resource = resourceRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(resource);
        return resource;
    }

    public void refreshDerivedStatus(Resource resource) {
        String current = resource.getStatus();
        if ("ON_LEAVE".equals(current) || "INACTIVE".equals(current)) {
            return;
        }
        List<ResourceAllocation> activeNow =
                allocationRepository.findActiveOverlappingNow(resource.getId(), LocalDate.now());
        if (activeNow.isEmpty()) {
            resource.setDerivedStatus("AVAILABLE");
            return;
        }
        BigDecimal pctSum = activeNow.stream()
                .map(a -> a.getAllocationPercentage() != null ? a.getAllocationPercentage() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (pctSum.compareTo(BigDecimal.valueOf(100)) >= 0) {
            resource.setDerivedStatus("FULLY_ALLOCATED");
        } else {
            resource.setDerivedStatus("PARTIALLY_ALLOCATED");
        }
    }

    private boolean canViewCostRate() {
        return fieldAclEvaluator.canView("resource", "costRate");
    }

    private boolean canViewBillingRate() {
        return fieldAclEvaluator.canView("resource", "billingRate");
    }

    private void requireRateWrite(String fieldCode, BigDecimal value) {
        if (value != null && !fieldAclEvaluator.canWrite("resource", fieldCode)) {
            throw new ForbiddenException("You do not have permission to change resource " + fieldCode);
        }
    }

    private Region requireRegionInOrg(UUID regionId, UUID organizationId) {
        Region region = regionRepository
                .findActiveById(regionId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!region.getOrganizationId().equals(organizationId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return region;
    }

    private static String normalizeType(String resourceType) {
        String type = resourceType == null ? "" : resourceType.trim().toUpperCase(Locale.ROOT);
        if (!Resource.TYPES.contains(type)) {
            throw new BusinessException(
                    "INVALID_RESOURCE_TYPE", "Resource type must be one of EMPLOYEE, CONTRACTOR, FREELANCER, CONSULTANT");
        }
        return type;
    }

    /**
     * Employees are the company's own staff and must be linked to an internal user account; external resources
     * (contractors, freelancers, consultants) need at least a name and get a login only through a portal invite.
     */
    private void assertPersonDetails(
            String resourceType, UUID organizationId, UUID userId, String fullName, UUID currentResourceId) {
        User user = null;
        if (userId != null) {
            user = userRepository
                    .findActiveDetailsById(userId)
                    .filter(found -> organizationId.equals(found.getOrganizationId()))
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));
            resourceRepository.findActiveByUserId(userId)
                    .filter(linked -> !linked.getId().equals(currentResourceId))
                    .ifPresent(linked -> {
                        throw new ConflictException("This user is already linked to resource "
                                + (linked.getEmployeeCode() != null ? linked.getEmployeeCode() : linked.getId()));
                    });
        }
        if (Resource.TYPE_EMPLOYEE.equals(resourceType)) {
            if (user == null) {
                throw new BusinessException(
                        "USER_REQUIRED", "Employees must be linked to a user account; add the person under Users first");
            }
            if (ResourcePortalService.isContributorOnly(user)) {
                throw new BusinessException(
                        "EXTERNAL_LOGIN",
                        "This user is an external contributor login; pick an internal user or choose an external type");
            }
        } else if (user == null && blankToNull(fullName) == null) {
            throw new BusinessException("NAME_REQUIRED", "Enter the full name of the external resource");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<ResourceResponse> data, PaginationMeta pagination) {}
}
