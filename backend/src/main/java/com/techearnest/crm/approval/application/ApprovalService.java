package com.techearnest.crm.approval.application;

import com.techearnest.crm.approval.api.dto.ApprovalDtos.ApprovalActionRequest;
import com.techearnest.crm.approval.api.dto.ApprovalDtos.ApprovalRequestResponse;
import com.techearnest.crm.approval.domain.ApprovalAction;
import com.techearnest.crm.approval.domain.ApprovalActionRepository;
import com.techearnest.crm.approval.domain.ApprovalRequest;
import com.techearnest.crm.approval.domain.ApprovalRequestRepository;
import com.techearnest.crm.approval.domain.ApprovalStep;
import com.techearnest.crm.approval.domain.ApprovalStepRepository;
import com.techearnest.crm.approval.domain.ApprovalWorkflow;
import com.techearnest.crm.approval.domain.ApprovalWorkflowRepository;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.RejectTimesheetRequest;
import com.techearnest.crm.timesheet.application.TimesheetService;
import com.techearnest.crm.timesheet.domain.Timesheet;
import com.techearnest.crm.timesheet.domain.TimesheetRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApprovalService {

    public static final String TARGET_TIMESHEET = "TIMESHEET";
    public static final String WORKFLOW_TIMESHEET_DEFAULT = "TIMESHEET_DEFAULT";

    private final ApprovalWorkflowRepository workflowRepository;
    private final ApprovalStepRepository stepRepository;
    private final ApprovalRequestRepository requestRepository;
    private final ApprovalActionRepository actionRepository;
    private final ResourceRepository resourceRepository;
    private final TimesheetRepository timesheetRepository;
    private final TenantAccess tenantAccess;
    private final TimesheetService timesheetService;

    public ApprovalService(
            ApprovalWorkflowRepository workflowRepository,
            ApprovalStepRepository stepRepository,
            ApprovalRequestRepository requestRepository,
            ApprovalActionRepository actionRepository,
            ResourceRepository resourceRepository,
            TimesheetRepository timesheetRepository,
            TenantAccess tenantAccess,
            @Lazy TimesheetService timesheetService) {
        this.workflowRepository = workflowRepository;
        this.stepRepository = stepRepository;
        this.requestRepository = requestRepository;
        this.actionRepository = actionRepository;
        this.resourceRepository = resourceRepository;
        this.timesheetRepository = timesheetRepository;
        this.tenantAccess = tenantAccess;
        this.timesheetService = timesheetService;
    }

    @Transactional
    public void openTimesheetRequest(Timesheet timesheet, UUID submittedBy) {
        ApprovalWorkflow workflow = ensureTimesheetWorkflow(timesheet.getOrganizationId(), submittedBy);
        List<ApprovalStep> steps =
                stepRepository.findByWorkflowIdAndActiveTrueOrderByStepOrderAsc(workflow.getId());
        if (steps.isEmpty()) {
            return;
        }
        if (requestRepository
                .findByOrganizationIdAndTargetTypeAndTargetIdAndStatus(
                        timesheet.getOrganizationId(), TARGET_TIMESHEET, timesheet.getId(), "PENDING")
                .isPresent()) {
            return;
        }
        requestRepository.save(ApprovalRequest.create(
                timesheet.getOrganizationId(),
                workflow.getId(),
                TARGET_TIMESHEET,
                timesheet.getId(),
                steps.get(0).getId(),
                submittedBy,
                timesheet.getRegionId()));
    }

    @Transactional
    public void syncApprove(UUID organizationId, String targetType, UUID targetId, UUID actorId, String comment) {
        closePending(organizationId, targetType, targetId, actorId, "APPROVE", comment);
    }

    @Transactional
    public void syncReject(UUID organizationId, String targetType, UUID targetId, UUID actorId, String comment) {
        closePending(organizationId, targetType, targetId, actorId, "REJECT", comment);
    }

    @Transactional(readOnly = true)
    public List<ApprovalRequestResponse> listMine(String targetType, String status) {
        CurrentUser user = requireInboxAccess();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        String st = status == null || status.isBlank() ? "PENDING" : status.trim().toUpperCase(Locale.ROOT);
        List<ApprovalRequestResponse> out = new ArrayList<>();
        for (ApprovalRequest request :
                requestRepository.findByOrganizationIdAndStatusOrderBySubmittedAtDesc(orgId, st)) {
            if (targetType != null
                    && !targetType.isBlank()
                    && !targetType.equalsIgnoreCase(request.getTargetType())) {
                continue;
            }
            if (isVisibleToUser(request, user)) {
                out.add(ApprovalRequestResponse.from(request));
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public ApprovalRequestResponse get(UUID id) {
        CurrentUser user = requireInboxAccess();
        return ApprovalRequestResponse.from(requireVisible(id, user));
    }

    @Transactional
    public ApprovalRequestResponse act(UUID id, ApprovalActionRequest body) {
        CurrentUser user = requireActAccess();
        ApprovalRequest request = requireVisible(id, user);
        if (!"PENDING".equals(request.getStatus())) {
            throw new BusinessException("INVALID_STATUS", "Only pending approvals can be actioned");
        }
        String action = body.action() == null ? "" : body.action().trim().toUpperCase(Locale.ROOT);
        if (!"APPROVE".equals(action) && !"REJECT".equals(action)) {
            throw new BusinessException("INVALID_ACTION", "action must be APPROVE or REJECT");
        }
        if (TARGET_TIMESHEET.equals(request.getTargetType())) {
            if ("APPROVE".equals(action)) {
                timesheetService.approve(request.getTargetId());
            } else {
                String reason = body.comment() == null || body.comment().isBlank()
                        ? "Rejected via approvals inbox"
                        : body.comment().trim();
                timesheetService.reject(request.getTargetId(), new RejectTimesheetRequest(reason));
            }
        } else {
            closePending(
                    request.getOrganizationId(),
                    request.getTargetType(),
                    request.getTargetId(),
                    user.userId(),
                    action,
                    body.comment());
        }
        return ApprovalRequestResponse.from(requestRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found")));
    }

    private void closePending(
            UUID organizationId, String targetType, UUID targetId, UUID actorId, String action, String comment) {
        ApprovalRequest pending = requestRepository
                .findByOrganizationIdAndTargetTypeAndTargetIdAndStatus(
                        organizationId, targetType, targetId, "PENDING")
                .orElse(null);
        if (pending == null) {
            return;
        }
        actionRepository.save(ApprovalAction.create(
                pending.getOrganizationId(),
                pending.getId(),
                pending.getCurrentStepId(),
                actorId,
                action,
                comment));
        if ("APPROVE".equals(action)) {
            pending.markApproved();
        } else {
            pending.markRejected();
        }
        requestRepository.save(pending);
    }

    private ApprovalWorkflow ensureTimesheetWorkflow(UUID organizationId, UUID createdBy) {
        return workflowRepository
                .findByOrganizationIdAndCode(organizationId, WORKFLOW_TIMESHEET_DEFAULT)
                .orElseGet(() -> {
                    ApprovalWorkflow workflow = ApprovalWorkflow.create(
                            organizationId,
                            TARGET_TIMESHEET,
                            WORKFLOW_TIMESHEET_DEFAULT,
                            "Timesheet approval",
                            createdBy);
                    workflowRepository.save(workflow);
                    stepRepository.save(ApprovalStep.create(
                            organizationId, workflow.getId(), 1, "SEQUENTIAL", "MANAGER", null, 1));
                    return workflow;
                });
    }

    private boolean isVisibleToUser(ApprovalRequest request, CurrentUser user) {
        if (user.hasPermission("APPROVAL_ADMIN")) {
            return true;
        }
        if (!TARGET_TIMESHEET.equals(request.getTargetType())) {
            return user.hasPermission("APPROVAL_VIEW") || user.hasPermission("APPROVAL_ACT");
        }
        if (!user.hasPermission("TIMESHEET_APPROVE") && !user.hasPermission("APPROVAL_ACT")) {
            return false;
        }
        Timesheet timesheet = timesheetRepository.findActiveById(request.getTargetId()).orElse(null);
        if (timesheet == null) {
            return false;
        }
        Resource resource = resourceRepository.findActiveById(timesheet.getResourceId()).orElse(null);
        if (resource == null) {
            return false;
        }
        ApprovalStep step = request.getCurrentStepId() == null
                ? null
                : stepRepository.findById(request.getCurrentStepId()).orElse(null);
        if (step != null && "MANAGER".equalsIgnoreCase(step.getApproverType())) {
            return Objects.equals(resource.getManagerId(), user.userId())
                    || user.hasPermission("APPROVAL_VIEW");
        }
        return true;
    }

    private ApprovalRequest requireVisible(UUID id, CurrentUser user) {
        ApprovalRequest request =
                requestRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        if (!Objects.equals(request.getOrganizationId(), orgId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        if (!isVisibleToUser(request, user)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return request;
    }

    private CurrentUser requireInboxAccess() {
        CurrentUser user = tenantAccess.currentUser();
        if (user.hasPermission("APPROVAL_VIEW")
                || user.hasPermission("APPROVAL_ACT")
                || user.hasPermission("TIMESHEET_APPROVE")
                || user.hasPermission("APPROVAL_ADMIN")) {
            return user;
        }
        throw new ForbiddenException("You do not have permission to perform this action");
    }

    private CurrentUser requireActAccess() {
        CurrentUser user = tenantAccess.currentUser();
        if (user.hasPermission("APPROVAL_ACT")
                || user.hasPermission("TIMESHEET_APPROVE")
                || user.hasPermission("APPROVAL_ADMIN")) {
            return user;
        }
        throw new ForbiddenException("You do not have permission to perform this action");
    }
}
