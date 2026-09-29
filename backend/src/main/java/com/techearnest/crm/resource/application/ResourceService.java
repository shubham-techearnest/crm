package com.techearnest.crm.resource.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.application.FieldAclEvaluator;
import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.region.domain.RegionRepository;
import com.techearnest.crm.resource.api.dto.ResourceDtos.CreateResourceRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ReplaceSkillsRequest;
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
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
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

    public ResourceService(
            ResourceRepository resourceRepository,
            ResourceSkillRepository resourceSkillRepository,
            ResourceAllocationRepository allocationRepository,
            SkillRepository skillRepository,
            RegionRepository regionRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            FieldAclEvaluator fieldAclEvaluator) {
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
        List<ResourceResponse> data = page.getContent().stream()
                .map(r -> ResourceResponse.from(r, includeCostRate, includeBillingRate))
                .toList();
        return new PageResult(data, PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public ResourceResponse get(UUID id) {
        tenantAccess.requirePermission("RESOURCE_VIEW");
        return ResourceResponse.from(requireVisibleResource(id), canViewCostRate(), canViewBillingRate());
    }

    @Transactional
    public ResourceResponse create(CreateResourceRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_MANAGE");
        requireRateWrite("costRate", request.costRate());
        requireRateWrite("billingRate", request.billingRate());
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        Region region = requireRegionInOrg(request.regionId(), orgId);
        tenantAccess.assertRegionVisible(region.getId());

        String employeeCode = blankToNull(request.employeeCode());
        if (employeeCode != null
                && resourceRepository.existsByOrganizationIdAndEmployeeCodeAndDeletedAtIsNull(orgId, employeeCode)) {
            throw new ConflictException("Employee code already exists");
        }

        Resource resource = Resource.create(
                orgId,
                region.getId(),
                request.userId(),
                employeeCode,
                blankToNull(request.designation()),
                request.departmentId(),
                request.managerId(),
                request.resourceType().trim(),
                request.joiningDate(),
                request.costRate(),
                request.billingRate(),
                request.capacityHoursPerWeek(),
                blankToNull(request.status()));
        resourceRepository.save(resource);
        refreshDerivedStatus(resource);
        auditService.record(orgId, user.userId(), "CREATE", "RESOURCE", resource.getId());
        return ResourceResponse.from(resource, canViewCostRate(), canViewBillingRate());
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
        resource.update(
                request.regionId(),
                request.userId(),
                request.employeeCode() != null ? request.employeeCode().trim() : null,
                request.designation(),
                request.departmentId(),
                request.managerId(),
                blankToNull(request.resourceType()),
                request.joiningDate(),
                request.costRate(),
                request.billingRate(),
                request.capacityHoursPerWeek(),
                blankToNull(request.status()));
        if (request.status() == null || request.status().isBlank()) {
            refreshDerivedStatus(resource);
        }
        auditService.record(resource.getOrganizationId(), user.userId(), "UPDATE", "RESOURCE", resource.getId());
        return ResourceResponse.from(resource, canViewCostRate(), canViewBillingRate());
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

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<ResourceResponse> data, PaginationMeta pagination) {}
}
