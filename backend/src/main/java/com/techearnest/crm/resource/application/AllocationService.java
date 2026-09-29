package com.techearnest.crm.resource.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.application.FieldAclEvaluator;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.resource.api.dto.ResourceDtos.AllocationResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.CreateAllocationRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UpdateAllocationRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UtilizationResponse;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocation;
import com.techearnest.crm.resource.domain.ResourceAllocationRepository;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AllocationService {

    private final ResourceAllocationRepository allocationRepository;
    private final ProjectRepository projectRepository;
    private final ResourceService resourceService;
    private final UtilizationService utilizationService;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final FieldAclEvaluator fieldAclEvaluator;

    public AllocationService(
            ResourceAllocationRepository allocationRepository,
            ProjectRepository projectRepository,
            ResourceService resourceService,
            UtilizationService utilizationService,
            TenantAccess tenantAccess,
            AuditService auditService,
            FieldAclEvaluator fieldAclEvaluator) {
        this.allocationRepository = allocationRepository;
        this.projectRepository = projectRepository;
        this.resourceService = resourceService;
        this.utilizationService = utilizationService;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.fieldAclEvaluator = fieldAclEvaluator;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            UUID resourceId,
            UUID projectId,
            String status,
            boolean overlapOnly,
            Pageable pageable) {
        tenantAccess.requirePermission("ALLOCATION_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Page<ResourceAllocation> page = allocationRepository.search(
                orgId, resourceId, projectId, blankToNull(status), regionIds, overlapOnly, pageable);
        boolean includeBillingRate = canViewRate("billingRate");
        boolean includeCostRate = canViewRate("costRate");
        List<AllocationResponse> data = page.getContent().stream()
                .map(a -> AllocationResponse.from(a, includeBillingRate, includeCostRate, null))
                .toList();
        return new PageResult(data, PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public AllocationResponse get(UUID id) {
        tenantAccess.requirePermission("ALLOCATION_VIEW");
        ResourceAllocation allocation = requireVisibleAllocation(id);
        return AllocationResponse.from(
                allocation, canViewRate("billingRate"), canViewRate("costRate"), null);
    }

    @Transactional
    public AllocationResult create(CreateAllocationRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_ALLOCATE");
        requireRateWrite("billingRate", request.billingRate());
        requireRateWrite("costRate", request.costRate());
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());

        Resource resource = resourceService.requireVisibleResource(request.resourceId());
        if (!resource.getOrganizationId().equals(orgId)) {
            throw new ResourceNotFoundException("Resource not found");
        }

        Project project = projectRepository
                .findActiveById(request.projectId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!project.getOrganizationId().equals(orgId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        tenantAccess.assertRecordVisible(project);

        if (request.endDate().isBefore(request.startDate())) {
            throw new BusinessException("INVALID_DATES", "endDate must be on or after startDate");
        }

        ResourceAllocation allocation = ResourceAllocation.create(
                orgId,
                project.getId(),
                resource.getId(),
                request.startDate(),
                request.endDate(),
                request.allocatedHours(),
                request.allocationPercentage(),
                blankToNull(request.role()),
                request.billingRate(),
                request.costRate(),
                blankToNull(request.status()));

        UtilizationResponse utilization = utilizationService.compute(
                resource, request.startDate(), request.endDate(), allocation, null);
        String warning = handleOverAllocation(utilization, Boolean.TRUE.equals(request.dryRun()), user);

        if (Boolean.TRUE.equals(request.dryRun())) {
            return new AllocationResult(
                    AllocationResponse.from(allocation, canViewRate("billingRate"), canViewRate("costRate"), warning),
                    warning != null ? warning : "Dry run completed");
        }

        allocationRepository.save(allocation);
        resourceService.refreshDerivedStatus(resource);
        auditService.record(orgId, user.userId(), "CREATE", "ALLOCATION", allocation.getId());
        return new AllocationResult(
                AllocationResponse.from(allocation, canViewRate("billingRate"), canViewRate("costRate"), warning),
                warning != null ? "Allocation created with over-allocation warning" : "Allocation created successfully");
    }

    @Transactional
    public AllocationResult update(UUID id, UpdateAllocationRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_ALLOCATE");
        requireRateWrite("billingRate", request.billingRate());
        requireRateWrite("costRate", request.costRate());
        ResourceAllocation allocation = requireVisibleAllocation(id);
        Resource resource = resourceService.requireVisibleResource(allocation.getResourceId());

        var start = request.startDate() != null ? request.startDate() : allocation.getStartDate();
        var end = request.endDate() != null ? request.endDate() : allocation.getEndDate();
        if (end.isBefore(start)) {
            throw new BusinessException("INVALID_DATES", "endDate must be on or after startDate");
        }

        ResourceAllocation candidate = ResourceAllocation.create(
                allocation.getOrganizationId(),
                allocation.getProjectId(),
                allocation.getResourceId(),
                start,
                end,
                request.allocatedHours() != null ? request.allocatedHours() : allocation.getAllocatedHours(),
                request.allocationPercentage() != null
                        ? request.allocationPercentage()
                        : allocation.getAllocationPercentage(),
                request.role() != null ? blankToNull(request.role()) : allocation.getRole(),
                request.billingRate() != null ? request.billingRate() : allocation.getBillingRate(),
                request.costRate() != null ? request.costRate() : allocation.getCostRate(),
                request.status() != null ? blankToNull(request.status()) : allocation.getStatus());

        UtilizationResponse utilization =
                utilizationService.compute(resource, start, end, candidate, allocation.getId());
        String warning = handleOverAllocation(utilization, Boolean.TRUE.equals(request.dryRun()), user);

        if (Boolean.TRUE.equals(request.dryRun())) {
            return new AllocationResult(
                    AllocationResponse.from(candidate, canViewRate("billingRate"), canViewRate("costRate"), warning),
                    warning != null ? warning : "Dry run completed");
        }

        allocation.update(
                request.startDate(),
                request.endDate(),
                request.allocatedHours() != null ? request.allocatedHours() : allocation.getAllocatedHours(),
                request.allocationPercentage() != null
                        ? request.allocationPercentage()
                        : allocation.getAllocationPercentage(),
                request.role() != null ? blankToNull(request.role()) : allocation.getRole(),
                request.billingRate() != null ? request.billingRate() : allocation.getBillingRate(),
                request.costRate() != null ? request.costRate() : allocation.getCostRate(),
                blankToNull(request.status()));
        resourceService.refreshDerivedStatus(resource);
        auditService.record(
                allocation.getOrganizationId(), user.userId(), "UPDATE", "ALLOCATION", allocation.getId());
        return new AllocationResult(
                AllocationResponse.from(allocation, canViewRate("billingRate"), canViewRate("costRate"), warning),
                warning != null
                        ? "Allocation updated with over-allocation warning"
                        : "Allocation updated successfully");
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_ALLOCATE");
        ResourceAllocation allocation = requireVisibleAllocation(id);
        Resource resource = resourceService.requireVisibleResource(allocation.getResourceId());
        allocation.markDeleted();
        resourceService.refreshDerivedStatus(resource);
        auditService.record(
                allocation.getOrganizationId(), user.userId(), "DELETE", "ALLOCATION", allocation.getId());
    }

    private String handleOverAllocation(UtilizationResponse utilization, boolean dryRun, CurrentUser user) {
        if (!utilization.overAllocated()) {
            return null;
        }
        if (dryRun) {
            return "OVER_ALLOCATED";
        }
        if (!user.hasPermission("ALLOCATION_OVERRIDE")) {
            throw new BusinessException("OVER_ALLOCATED", "Allocation exceeds resource capacity");
        }
        return "OVER_ALLOCATED";
    }

    private ResourceAllocation requireVisibleAllocation(UUID id) {
        ResourceAllocation allocation = allocationRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        resourceService.requireVisibleResource(allocation.getResourceId());
        return allocation;
    }

    private boolean canViewRate(String fieldCode) {
        return fieldAclEvaluator.canView("allocation", fieldCode);
    }

    private void requireRateWrite(String fieldCode, java.math.BigDecimal value) {
        if (value != null && !fieldAclEvaluator.canWrite("allocation", fieldCode)) {
            throw new ForbiddenException("You do not have permission to change allocation " + fieldCode);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<AllocationResponse> data, PaginationMeta pagination) {}

    public record AllocationResult(AllocationResponse data, String message) {}
}
