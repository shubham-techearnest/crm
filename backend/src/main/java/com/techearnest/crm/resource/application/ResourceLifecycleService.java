package com.techearnest.crm.resource.application;

import com.techearnest.crm.audit.application.AuditFieldChanges;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.resource.api.dto.ResourceDtos.DeactivateResourceRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ReactivateResourceRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ResourceLifecycleResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UnavailabilityRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UnavailabilityResponse;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocationRepository;
import com.techearnest.crm.resource.domain.ResourceUnavailability;
import com.techearnest.crm.resource.domain.ResourceUnavailabilityRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Deactivation, reactivation and leave for resources. History (allocations, timesheets) is always kept. */
@Service
public class ResourceLifecycleService {

    private final ResourceService resourceService;
    private final AllocationService allocationService;
    private final ResourcePortalService portalService;
    private final ResourceAllocationRepository allocationRepository;
    private final ResourceUnavailabilityRepository unavailabilityRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public ResourceLifecycleService(
            ResourceService resourceService,
            AllocationService allocationService,
            ResourcePortalService portalService,
            ResourceAllocationRepository allocationRepository,
            ResourceUnavailabilityRepository unavailabilityRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.resourceService = resourceService;
        this.allocationService = allocationService;
        this.portalService = portalService;
        this.allocationRepository = allocationRepository;
        this.unavailabilityRepository = unavailabilityRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional
    public ResourceLifecycleResponse deactivate(UUID id, DeactivateResourceRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_MANAGE");
        Resource resource = resourceService.requireVisibleResource(id);
        String status = request == null || request.status() == null || request.status().isBlank()
                ? Resource.STATUS_INACTIVE
                : request.status().trim().toUpperCase(Locale.ROOT);
        if (!Resource.ENDED_STATUSES.contains(status)) {
            throw new BusinessException(
                    "INVALID_STATUS", "Deactivation status must be one of " + Resource.ENDED_STATUSES);
        }
        if (!resource.isActiveWorkforce()) {
            throw new BusinessException("ALREADY_INACTIVE", "This resource is already inactive");
        }
        LocalDate effectiveDate = request != null && request.effectiveDate() != null
                ? request.effectiveDate()
                : LocalDate.now();
        boolean hasOpen = !allocationRepository.findActiveOrPlannedByResource(resource.getId()).isEmpty();
        int[] counts = {0, 0};
        if (hasOpen) {
            if (request == null || !Boolean.TRUE.equals(request.endOpenAllocations())) {
                throw new BusinessException(
                        "OPEN_ALLOCATIONS",
                        "This resource still has open allocations. Confirm ending them to deactivate.");
            }
            counts = allocationService.endAllForResource(resource, effectiveDate, user);
        }
        String previousStatus = resource.getStatus();
        resource.deactivate(status, request == null ? null : request.reason());
        boolean revoked = request != null
                && Boolean.TRUE.equals(request.revokePortalAccess())
                && portalService.revokeContributorLogin(resource);
        String summary = AuditFieldChanges.builder()
                .addIfChanged("status", "Status", previousStatus, resource.getStatus())
                .addIfChanged("deactivationReason", "Reason", null, resource.getDeactivationReason())
                .addIfChanged("effectiveDate", "Effective", null, effectiveDate)
                .addIfChanged("allocationsEnded", "Allocations ended", null, counts[0] + counts[1] > 0
                        ? String.valueOf(counts[0] + counts[1])
                        : null)
                .addIfChanged("portalAccess", "Portal access", null, revoked ? "Revoked" : null)
                .toJson();
        record(resource, user, "DEACTIVATE", summary);
        return new ResourceLifecycleResponse(resourceService.toResponse(resource), counts[0], counts[1], revoked);
    }

    @Transactional
    public ResourceLifecycleResponse reactivate(UUID id, ReactivateResourceRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_MANAGE");
        Resource resource = resourceService.requireVisibleResource(id);
        if (resource.isActiveWorkforce()) {
            throw new BusinessException("ALREADY_ACTIVE", "This resource is already active");
        }
        LocalDate engagementStart = request == null ? null : request.engagementStartDate();
        LocalDate engagementEnd = request == null ? null : request.engagementEndDate();
        if (engagementEnd != null && engagementEnd.isBefore(LocalDate.now())) {
            throw new BusinessException("INVALID_DATE", "The new engagement end date must be in the future");
        }
        if (engagementStart != null && engagementEnd != null && engagementEnd.isBefore(engagementStart)) {
            throw new BusinessException("INVALID_DATE", "Engagement end must be on or after its start");
        }
        String previousStatus = resource.getStatus();
        LocalDate previousEnd = resource.getEngagementEndDate();
        resource.reactivate(engagementStart, engagementEnd);
        if (request != null && request.availableFrom() != null) {
            resource.updateProfile(null, null, null, null, null, null, null, request.availableFrom(), null, null);
        }
        resourceService.refreshDerivedStatus(resource);
        portalService.syncEngagementEnd(resource);
        String summary = AuditFieldChanges.builder()
                .addIfChanged("status", "Status", previousStatus, resource.getStatus())
                .addIfChanged("engagementEndDate", "Engagement end", previousEnd, resource.getEngagementEndDate())
                .toJson();
        record(resource, user, "REACTIVATE", summary);
        return new ResourceLifecycleResponse(resourceService.toResponse(resource), 0, 0, false);
    }

    @Transactional(readOnly = true)
    public List<UnavailabilityResponse> listUnavailability(UUID resourceId) {
        tenantAccess.requirePermission("RESOURCE_VIEW");
        Resource resource = resourceService.requireVisibleResource(resourceId);
        return unavailabilityRepository.findActiveByResource(resource.getId()).stream()
                .map(UnavailabilityResponse::from)
                .toList();
    }

    @Transactional
    public UnavailabilityResponse addUnavailability(UUID resourceId, UnavailabilityRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_MANAGE");
        Resource resource = resourceService.requireVisibleResource(resourceId);
        if (request.endDate().isBefore(request.startDate())) {
            throw new BusinessException("INVALID_DATE", "Leave end must be on or after its start");
        }
        String kind = request.kind() == null || request.kind().isBlank()
                ? "LEAVE"
                : request.kind().trim().toUpperCase(Locale.ROOT);
        if (!ResourceUnavailability.KINDS.contains(kind)) {
            throw new BusinessException("INVALID_KIND", "Leave type must be one of " + ResourceUnavailability.KINDS);
        }
        if (request.hoursPerDay() != null && resource.getWorkingHoursPerDay() != null
                && request.hoursPerDay().compareTo(resource.getWorkingHoursPerDay()) > 0) {
            throw new BusinessException("INVALID_HOURS", "Hours off cannot exceed the resource's working day");
        }
        ResourceUnavailability leave = unavailabilityRepository.save(ResourceUnavailability.create(
                resource.getOrganizationId(), resource.getId(), request.startDate(), request.endDate(),
                kind, request.hoursPerDay(), request.reason()));
        String summary = AuditFieldChanges.builder()
                .addIfChanged("resourceId", "Resource", null, resource.getId())
                .addIfChanged("kind", "Type", null, kind)
                .addIfChanged("startDate", "Start", null, leave.getStartDate())
                .addIfChanged("endDate", "End", null, leave.getEndDate())
                .toJson();
        auditService.recordWithSummary(
                resource.getOrganizationId(), user.userId(), "CREATE", "RESOURCE_LEAVE", leave.getId(), summary);
        return UnavailabilityResponse.from(leave);
    }

    @Transactional
    public void removeUnavailability(UUID leaveId) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_MANAGE");
        ResourceUnavailability leave = unavailabilityRepository.findActiveById(leaveId)
                .orElseThrow(() -> new ResourceNotFoundException("Leave not found"));
        resourceService.requireVisibleResource(leave.getResourceId());
        leave.markDeleted();
        auditService.record(leave.getOrganizationId(), user.userId(), "DELETE", "RESOURCE_LEAVE", leave.getId());
    }

    private void record(Resource resource, CurrentUser user, String action, String summary) {
        if (summary != null) {
            auditService.recordWithSummary(
                    resource.getOrganizationId(), user.userId(), action, "RESOURCE", resource.getId(), summary);
        } else {
            auditService.record(resource.getOrganizationId(), user.userId(), action, "RESOURCE", resource.getId());
        }
    }
}
