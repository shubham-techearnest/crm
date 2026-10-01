package com.techearnest.crm.resource.application;

import com.techearnest.crm.audit.application.AuditFieldChanges;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.application.FieldAclEvaluator;
import com.techearnest.crm.project.domain.MilestoneRepository;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.resource.api.dto.ResourceDtos.AllocationResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.CreateAllocationRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.EndAllocationRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UpdateAllocationRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UtilizationResponse;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocation;
import com.techearnest.crm.resource.domain.ResourceAllocationRepository;
import com.techearnest.crm.timesheet.domain.TimeEntryRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AllocationService {

    private static final Set<String> CLOSED_PROJECT_STATUSES = Set.of("COMPLETED", "CANCELLED");

    private final ResourceAllocationRepository allocationRepository;
    private final ProjectRepository projectRepository;
    private final MilestoneRepository milestoneRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final ResourceService resourceService;
    private final UtilizationService utilizationService;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final FieldAclEvaluator fieldAclEvaluator;

    public AllocationService(
            ResourceAllocationRepository allocationRepository,
            ProjectRepository projectRepository,
            MilestoneRepository milestoneRepository,
            TimeEntryRepository timeEntryRepository,
            ResourceService resourceService,
            UtilizationService utilizationService,
            TenantAccess tenantAccess,
            AuditService auditService,
            FieldAclEvaluator fieldAclEvaluator) {
        this.allocationRepository = allocationRepository;
        this.projectRepository = projectRepository;
        this.milestoneRepository = milestoneRepository;
        this.timeEntryRepository = timeEntryRepository;
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
        String status = normalizeStatus(request.status());
        String source = normalizeSource(request.source());
        validateMilestone(request.milestoneId(), project);

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
                status);
        allocation.updateTerms(
                request.billable() != null ? request.billable() : resource.isBillable(),
                source,
                request.notes(),
                request.milestoneId());

        List<String> warnings = new ArrayList<>();
        if (allocation.isOpen()) {
            assertResourceCanWork(resource);
            assertProjectOpen(project);
            checkEngagementWindow(resource, request.startDate(), request.endDate(), user, warnings);
            checkProjectWindow(project, request.startDate(), request.endDate(), warnings);
        }

        UtilizationResponse utilization = utilizationService.compute(
                resource, request.startDate(), request.endDate(), allocation, null);
        String warning = handleOverAllocation(utilization, Boolean.TRUE.equals(request.dryRun()), user);
        if (warning != null) {
            warnings.add("Allocation exceeds this resource's capacity for the period");
        }

        if (Boolean.TRUE.equals(request.dryRun())) {
            return new AllocationResult(
                    response(allocation, warning, warnings),
                    warning != null ? warning : "Dry run completed");
        }

        allocationRepository.save(allocation);
        resourceService.refreshDerivedStatus(resource);
        auditService.recordWithSummary(orgId, user.userId(), "CREATE", "ALLOCATION", allocation.getId(),
                AuditFieldChanges.builder()
                        .addIfChanged("resourceId", "Resource", null, resource.getId())
                        .addIfChanged("projectId", "Project", null, project.getId())
                        .addIfChanged("allocationPercentage", "Allocation %", null, allocation.getAllocationPercentage())
                        .addIfChanged("startDate", "Start", null, allocation.getStartDate())
                        .addIfChanged("endDate", "End", null, allocation.getEndDate())
                        .addIfChanged("status", "Status", null, allocation.getStatus())
                        .toJson());
        return new AllocationResult(
                response(allocation, warning, warnings),
                warning != null ? "Allocation created with over-allocation warning" : "Allocation created successfully");
    }

    @Transactional
    public AllocationResult update(UUID id, UpdateAllocationRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_ALLOCATE");
        requireRateWrite("billingRate", request.billingRate());
        requireRateWrite("costRate", request.costRate());
        ResourceAllocation allocation = requireVisibleAllocation(id);
        Resource resource = resourceService.requireVisibleResource(allocation.getResourceId());
        Project project = projectRepository
                .findActiveById(allocation.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));

        var start = request.startDate() != null ? request.startDate() : allocation.getStartDate();
        var end = request.endDate() != null ? request.endDate() : allocation.getEndDate();
        if (end.isBefore(start)) {
            throw new BusinessException("INVALID_DATES", "endDate must be on or after startDate");
        }
        String status = request.status() != null && !request.status().isBlank()
                ? normalizeStatus(request.status())
                : allocation.getStatus();
        validateMilestone(request.milestoneId(), project);

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
                status);

        List<String> warnings = new ArrayList<>();
        boolean datesOrLoadChanged = !start.equals(allocation.getStartDate())
                || !end.equals(allocation.getEndDate())
                || request.allocationPercentage() != null
                || request.allocatedHours() != null
                || !status.equals(allocation.getStatus());
        if (candidate.isOpen() && datesOrLoadChanged) {
            assertResourceCanWork(resource);
            checkEngagementWindow(resource, start, end, user, warnings);
            checkProjectWindow(project, start, end, warnings);
        }

        UtilizationResponse utilization =
                utilizationService.compute(resource, start, end, candidate, allocation.getId());
        String warning = candidate.isOpen()
                ? handleOverAllocation(utilization, Boolean.TRUE.equals(request.dryRun()), user)
                : null;
        if (warning != null) {
            warnings.add("Allocation exceeds this resource's capacity for the period");
        }

        if (Boolean.TRUE.equals(request.dryRun())) {
            return new AllocationResult(
                    response(candidate, warning, warnings),
                    warning != null ? warning : "Dry run completed");
        }

        AuditFieldChanges.Builder changes = AuditFieldChanges.builder()
                .addIfChanged("startDate", "Start", allocation.getStartDate(), start)
                .addIfChanged("endDate", "End", allocation.getEndDate(), end)
                .addIfChanged("allocationPercentage", "Allocation %",
                        allocation.getAllocationPercentage(), candidate.getAllocationPercentage())
                .addIfChanged("allocatedHours", "Allocated hours",
                        allocation.getAllocatedHours(), candidate.getAllocatedHours())
                .addIfChanged("role", "Role", allocation.getRole(), candidate.getRole())
                .addIfChanged("billingRate", "Billing rate", allocation.getBillingRate(), candidate.getBillingRate())
                .addIfChanged("costRate", "Cost rate", allocation.getCostRate(), candidate.getCostRate())
                .addIfChanged("status", "Status", allocation.getStatus(), status)
                .addIfChanged("billable", "Billable", allocation.isBillable(),
                        request.billable() != null ? request.billable() : allocation.isBillable());

        allocation.update(
                request.startDate(),
                request.endDate(),
                candidate.getAllocatedHours(),
                candidate.getAllocationPercentage(),
                candidate.getRole(),
                candidate.getBillingRate(),
                candidate.getCostRate(),
                status);
        allocation.updateTerms(request.billable(), null, request.notes(), request.milestoneId());
        if (Boolean.TRUE.equals(request.clearMilestone())) {
            allocation.clearMilestone();
        }
        resourceService.refreshDerivedStatus(resource);
        recordAudit(allocation, user, "UPDATE", changes);
        return new AllocationResult(
                response(allocation, warning, warnings),
                warning != null
                        ? "Allocation updated with over-allocation warning"
                        : "Allocation updated successfully");
    }

    /** Ends an allocation early (or on its planned date) and keeps it as history. */
    @Transactional
    public AllocationResult end(UUID id, EndAllocationRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_ALLOCATE");
        ResourceAllocation allocation = requireVisibleAllocation(id);
        if (!allocation.isOpen()) {
            throw new BusinessException("INVALID_STATUS", "Only planned or active allocations can be ended");
        }
        Resource resource = resourceService.requireVisibleResource(allocation.getResourceId());
        LocalDate endDate = request != null && request.endDate() != null ? request.endDate() : LocalDate.now();
        AuditFieldChanges.Builder changes = AuditFieldChanges.builder();
        LocalDate previousEnd = allocation.getEndDate();
        String previousStatus = allocation.getStatus();
        allocation.end(endDate, user.userId());
        changes.addIfChanged("endDate", "End", previousEnd, allocation.getEndDate())
                .addIfChanged("status", "Status", previousStatus, allocation.getStatus());
        if (request != null && request.reason() != null && !request.reason().isBlank()) {
            changes.addIfChanged("reason", "Reason", null, request.reason().trim());
        }
        resourceService.refreshDerivedStatus(resource);
        recordAudit(allocation, user, "END", changes);
        return new AllocationResult(response(allocation, null, List.of()), "Allocation ended");
    }

    /** Ends every open allocation of a resource; used when a resource is deactivated. Returns [ended, cancelled]. */
    int[] endAllForResource(Resource resource, LocalDate endDate, CurrentUser user) {
        int ended = 0;
        int cancelled = 0;
        for (ResourceAllocation allocation : allocationRepository.findActiveOrPlannedByResource(resource.getId())) {
            LocalDate previousEnd = allocation.getEndDate();
            String previousStatus = allocation.getStatus();
            allocation.end(endDate, user.userId());
            if (ResourceAllocation.STATUS_CANCELLED.equals(allocation.getStatus())) {
                cancelled++;
            } else {
                ended++;
            }
            recordAudit(allocation, user, "END", AuditFieldChanges.builder()
                    .addIfChanged("endDate", "End", previousEnd, allocation.getEndDate())
                    .addIfChanged("status", "Status", previousStatus, allocation.getStatus()));
        }
        return new int[] {ended, cancelled};
    }

    /** Removes an allocation created by mistake. Allocations with logged time must be ended instead. */
    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_ALLOCATE");
        ResourceAllocation allocation = requireVisibleAllocation(id);
        Resource resource = resourceService.requireVisibleResource(allocation.getResourceId());
        if (timeEntryRepository.existsForResourceProjectBetween(
                allocation.getResourceId(), allocation.getProjectId(),
                allocation.getStartDate(), allocation.getEndDate())) {
            throw new BusinessException(
                    "HAS_HISTORY", "Time has been logged against this allocation. End it instead of deleting it.");
        }
        allocation.markDeleted();
        resourceService.refreshDerivedStatus(resource);
        auditService.record(
                allocation.getOrganizationId(), user.userId(), "DELETE", "ALLOCATION", allocation.getId());
    }

    private void recordAudit(ResourceAllocation allocation, CurrentUser user, String action, AuditFieldChanges.Builder changes) {
        String summary = changes.toJson();
        if (summary != null) {
            auditService.recordWithSummary(
                    allocation.getOrganizationId(), user.userId(), action, "ALLOCATION", allocation.getId(), summary);
        } else {
            auditService.record(allocation.getOrganizationId(), user.userId(), action, "ALLOCATION", allocation.getId());
        }
    }

    private static void assertResourceCanWork(Resource resource) {
        if (Resource.ENDED_STATUSES.contains(resource.getStatus())) {
            throw new BusinessException(
                    "RESOURCE_INACTIVE",
                    "This resource is " + resource.getStatus().toLowerCase(Locale.ROOT).replace('_', ' ')
                            + ". Reactivate it before allocating it to a project.");
        }
    }

    private static void assertProjectOpen(Project project) {
        if (project.getStatus() != null && CLOSED_PROJECT_STATUSES.contains(project.getStatus())) {
            throw new BusinessException(
                    "PROJECT_CLOSED",
                    "Project " + project.getName() + " is " + project.getStatus().toLowerCase(Locale.ROOT)
                            + "; resources can no longer be allocated to it");
        }
    }

    /**
     * External resources may only be allocated inside their engagement window. Without ALLOCATION_OVERRIDE the
     * conflict is rejected; with it the allocation is saved with a warning.
     */
    private static void checkEngagementWindow(
            Resource resource, LocalDate start, LocalDate end, CurrentUser user, List<String> warnings) {
        if (!resource.isExternal()) {
            return;
        }
        String conflict = null;
        if (resource.getEngagementStartDate() != null && start.isBefore(resource.getEngagementStartDate())) {
            conflict = "The allocation starts on " + start + ", before this resource's engagement starts on "
                    + resource.getEngagementStartDate() + ".";
        } else if (resource.getEngagementEndDate() != null && end.isAfter(resource.getEngagementEndDate())) {
            conflict = "The allocation runs until " + end + ", after this resource's engagement ends on "
                    + resource.getEngagementEndDate() + ".";
        }
        if (conflict == null) {
            return;
        }
        if (!user.hasPermission("ALLOCATION_OVERRIDE")) {
            throw new BusinessException(
                    "ENGAGEMENT_CONFLICT", conflict + " Extend the engagement or shorten the allocation.");
        }
        warnings.add(conflict);
    }

    private static void checkProjectWindow(Project project, LocalDate start, LocalDate end, List<String> warnings) {
        if (project.getEndDate() != null && end.isAfter(project.getEndDate())) {
            warnings.add("The allocation ends after the project's end date (" + project.getEndDate() + ").");
        }
        if (project.getStartDate() != null && start.isBefore(project.getStartDate())) {
            warnings.add("The allocation starts before the project's start date (" + project.getStartDate() + ").");
        }
    }

    private void validateMilestone(UUID milestoneId, Project project) {
        if (milestoneId == null) {
            return;
        }
        milestoneRepository.findActiveById(milestoneId)
                .filter(m -> project.getId().equals(m.getProjectId()))
                .orElseThrow(() -> new BusinessException(
                        "INVALID_MILESTONE", "The milestone does not belong to this project"));
    }

    private static String normalizeStatus(String status) {
        String value = blankToNull(status);
        if (value == null) {
            return ResourceAllocation.STATUS_PLANNED;
        }
        value = value.toUpperCase(Locale.ROOT);
        if (!ResourceAllocation.STATUSES.contains(value)) {
            throw new BusinessException("INVALID_STATUS", "Allocation status must be PLANNED, ACTIVE, COMPLETED or CANCELLED");
        }
        return value;
    }

    private static String normalizeSource(String source) {
        String value = blankToNull(source);
        if (value == null) {
            return ResourceAllocation.SOURCE_MANUAL;
        }
        value = value.toUpperCase(Locale.ROOT);
        if (!ResourceAllocation.SOURCES.contains(value)) {
            throw new BusinessException("INVALID_SOURCE", "Unknown allocation source " + value);
        }
        return value;
    }

    private AllocationResponse response(ResourceAllocation allocation, String warning, List<String> warnings) {
        return AllocationResponse.from(
                allocation, canViewRate("billingRate"), canViewRate("costRate"), warning, List.copyOf(warnings));
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

    private void requireRateWrite(String fieldCode, BigDecimal value) {
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
