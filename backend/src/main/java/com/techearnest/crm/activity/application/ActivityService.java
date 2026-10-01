package com.techearnest.crm.activity.application;

import com.techearnest.crm.activity.api.dto.ActivityDtos.ActivityResponse;
import com.techearnest.crm.activity.api.dto.ActivityDtos.CreateActivityRequest;
import com.techearnest.crm.activity.api.dto.ActivityDtos.UpdateActivityRequest;
import com.techearnest.crm.activity.domain.Activity;
import com.techearnest.crm.activity.domain.ActivityRepository;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.bulk.BulkDtos.BulkAssignOwnerRequest;
import com.techearnest.crm.common.bulk.BulkDtos.BulkResult;
import com.techearnest.crm.common.bulk.BulkExecutor;
import com.techearnest.crm.user.application.OwnerValidator;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityService {

    private final ActivityRepository activityRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final OwnerValidator ownerValidator;

    public ActivityService(
            ActivityRepository activityRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            OwnerValidator ownerValidator) {
        this.ownerValidator = ownerValidator;
        this.activityRepository = activityRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String relatedEntityType,
            UUID relatedEntityId,
            UUID assignedTo,
            String type,
            String status,
            String outcome,
            String callDirection,
            java.time.Instant dueFrom,
            java.time.Instant dueTo,
            Pageable pageable) {
        tenantAccess.requirePermission("ACTIVITY_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> ownerIds = tenantAccess.ownerIdsFilterOrNull();
        Collection<UUID> assigneeIds =
                assignedTo != null ? Set.of(assignedTo) : ownerIds;
        Page<Activity> page = activityRepository.search(
                orgId,
                regionIds,
                assigneeIds,
                blankToNull(relatedEntityType),
                relatedEntityId,
                blankToNull(type),
                blankToNull(status),
                blankToNull(outcome),
                blankToNull(callDirection),
                dueFrom,
                dueTo,
                pageable);
        return new PageResult(page.map(ActivityResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public ActivityResponse get(UUID id) {
        tenantAccess.requirePermission("ACTIVITY_VIEW");
        return ActivityResponse.from(requireVisibleActivity(id));
    }

    @Transactional
    public ActivityResponse create(CreateActivityRequest request) {
        CurrentUser user = tenantAccess.requirePermission("ACTIVITY_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        if (request.regionId() != null) {
            tenantAccess.assertRegionVisible(request.regionId());
        }
        UUID assignedTo = request.assignedTo() != null ? request.assignedTo() : user.userId();

        Activity activity = Activity.create(
                orgId,
                request.regionId(),
                request.type().trim(),
                request.subject().trim(),
                request.description(),
                request.status(),
                blankToNull(request.priority()),
                request.dueDate(),
                assignedTo,
                request.relatedEntityType().trim(),
                request.relatedEntityId(),
                blankToNull(request.location()),
                blankToNull(request.attendees()),
                blankToNull(request.outcome()),
                blankToNull(request.callDirection()),
                request.durationSeconds());
        activityRepository.save(activity);
        auditService.record(orgId, user.userId(), "CREATE", "ACTIVITY", activity.getId());
        return ActivityResponse.from(activity);
    }

    @Transactional
    public ActivityResponse update(UUID id, UpdateActivityRequest request) {
        CurrentUser user = tenantAccess.requirePermission("ACTIVITY_UPDATE");
        Activity activity = requireVisibleActivity(id);
        activity.update(
                blankToNull(request.type()),
                request.subject().trim(),
                request.description(),
                request.status(),
                blankToNull(request.priority()),
                request.dueDate(),
                request.assignedTo(),
                blankToNull(request.location()),
                blankToNull(request.attendees()),
                blankToNull(request.outcome()),
                blankToNull(request.callDirection()),
                request.durationSeconds());
        auditService.record(activity.getOrganizationId(), user.userId(), "UPDATE", "ACTIVITY", activity.getId());
        return ActivityResponse.from(activity);
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("ACTIVITY_DELETE");
        Activity activity = requireVisibleActivity(id);
        activity.markDeleted();
        auditService.record(activity.getOrganizationId(), user.userId(), "DELETE", "ACTIVITY", activity.getId());
    }

    @Transactional
    public ActivityResponse complete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("ACTIVITY_COMPLETE");
        Activity activity = requireVisibleActivity(id);
        activity.complete();
        auditService.record(activity.getOrganizationId(), user.userId(), "UPDATE", "ACTIVITY", activity.getId());
        return ActivityResponse.from(activity);
    }

    @Transactional
    public BulkResult bulkAssign(BulkAssignOwnerRequest request) {
        CurrentUser user = tenantAccess.requirePermission("ACTIVITY_UPDATE");
        UUID ownerOrgId = ownerValidator.requireActiveOwner(request.ownerId());
        return BulkExecutor.run(request.ids(), "activity", id -> {
            Activity activity = requireVisibleActivity(id);
            OwnerValidator.requireSameOrganization(ownerOrgId, activity.getOrganizationId());
            activity.reassign(request.ownerId());
            auditService.recordWithSummary(
                    activity.getOrganizationId(),
                    user.userId(),
                    "ASSIGN",
                    "ACTIVITY",
                    activity.getId(),
                    "{\"bulk\":true,\"assignedTo\":\"" + request.ownerId() + "\"}");
        });
    }

    private Activity requireVisibleActivity(UUID id) {
        Activity activity = activityRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(activity);
        return activity;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<ActivityResponse> data, PaginationMeta pagination) {}
}
