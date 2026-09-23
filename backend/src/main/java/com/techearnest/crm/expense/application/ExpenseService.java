package com.techearnest.crm.expense.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.expense.api.dto.ExpenseDtos.CreateExpenseRequest;
import com.techearnest.crm.expense.api.dto.ExpenseDtos.ExpenseResponse;
import com.techearnest.crm.expense.api.dto.ExpenseDtos.QueryExpenseRequest;
import com.techearnest.crm.expense.api.dto.ExpenseDtos.RejectExpenseRequest;
import com.techearnest.crm.expense.api.dto.ExpenseDtos.UpdateExpenseRequest;
import com.techearnest.crm.expense.domain.Expense;
import com.techearnest.crm.expense.domain.ExpenseRepository;
import com.techearnest.crm.filter.FilterSpecificationBuilder;
import com.techearnest.crm.notification.application.NotificationService;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceRepository;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ResourceRepository resourceRepository;
    private final ProjectRepository projectRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public ExpenseService(
            ExpenseRepository expenseRepository,
            ResourceRepository resourceRepository,
            ProjectRepository projectRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            NotificationService notificationService) {
        this.expenseRepository = expenseRepository;
        this.resourceRepository = resourceRepository;
        this.projectRepository = projectRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String search,
            String status,
            String category,
            UUID projectId,
            UUID resourceId,
            Boolean billable,
            Pageable pageable) {

        tenantAccess.requirePermission("EXPENSE_VIEW");

        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();

        Page<Expense> page = expenseRepository.search(
                orgId,
                blankToNull(search),
                regionIds,
                blankToNull(status),
                blankToNull(category),
                projectId,
                resourceId,
                billable,
                pageable);

        return new PageResult(
                page.map(ExpenseResponse::from).getContent(),
                PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public PageResult query(QueryExpenseRequest request) {

        tenantAccess.requirePermission("EXPENSE_VIEW");

        UUID orgId =
                tenantAccess.resolveOrganizationId(
                        request == null ? null : request.organizationId());

        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();

        int page =
                request != null && request.page() != null
                        ? request.page()
                        : 0;

        int size =
                request != null && request.size() != null
                        ? Math.min(request.size(), 100)
                        : 50;

        Pageable pageable = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "expenseDate"));

        Specification<Expense> filterSpec =
                FilterSpecificationBuilder.build(
                        request == null ? null : request.filter(),
                        ExpenseFilterFields.ALLOWED);

        Page<Expense> result = expenseRepository.searchWithFilter(
                orgId,
                request == null ? null : blankToNull(request.search()),
                regionIds,
                request == null ? null : blankToNull(request.status()),
                request == null ? null : blankToNull(request.category()),
                request == null ? null : request.projectId(),
                request == null ? null : request.resourceId(),
                request == null ? null : request.billable(),
                filterSpec,
                pageable);

        return new PageResult(
                result.map(ExpenseResponse::from).getContent(),
                PaginationMeta.from(result));
    }

    @Transactional(readOnly = true)
    public ExpenseResponse get(UUID id) {
        tenantAccess.requirePermission("EXPENSE_VIEW");
        return ExpenseResponse.from(requireVisible(id));
    }

    @Transactional
    public ExpenseResponse create(CreateExpenseRequest request) {

        CurrentUser user =
                tenantAccess.requirePermission("EXPENSE_CREATE");

        UUID orgId =
                tenantAccess.resolveOrganizationId(
                        request.organizationId());

        tenantAccess.assertRegionVisible(request.regionId());

        UUID resourceId =
                resolveResourceId(
                        orgId,
                        request.resourceId(),
                        user);

        UUID projectId =
                resolveProjectId(
                        orgId,
                        request.projectId());

        Expense expense = Expense.create(
                orgId,
                request.regionId(),
                resourceId,
                projectId,
                request.category(),
                request.description(),
                request.amount(),
                request.currencyCode(),
                request.expenseDate(),
                Boolean.TRUE.equals(request.billable()),
                request.notes(),
                user.userId());

        expenseRepository.save(expense);

        auditService.record(
                orgId,
                user.userId(),
                "CREATE",
                "EXPENSE",
                expense.getId());

        return ExpenseResponse.from(expense);
    }

    @Transactional
    public ExpenseResponse update(
            UUID id,
            UpdateExpenseRequest request) {

        CurrentUser user =
                tenantAccess.requirePermission("EXPENSE_UPDATE");

        Expense expense = requireVisible(id);

        if (!expense.isEditable()) {
            throw new BusinessException(
                    "INVALID_STATUS",
                    "Only draft or rejected expenses can be updated");
        }

        UUID resourceId =
                request.resourceId() != null
                        ? resolveResourceId(
                                expense.getOrganizationId(),
                                request.resourceId(),
                                user)
                        : null;

        UUID projectId =
                request.projectId() != null
                        ? resolveProjectId(
                                expense.getOrganizationId(),
                                request.projectId())
                        : null;

        expense.update(
                resourceId,
                projectId,
                request.category(),
                request.description(),
                request.amount(),
                request.currencyCode(),
                request.expenseDate(),
                request.billable(),
                request.notes(),
                user.userId());

        auditService.record(
                expense.getOrganizationId(),
                user.userId(),
                "UPDATE",
                "EXPENSE",
                expense.getId());

        return ExpenseResponse.from(expense);
    }

    @Transactional
    public void softDelete(UUID id) {

        CurrentUser user =
                tenantAccess.requirePermission("EXPENSE_DELETE");

        Expense expense = requireVisible(id);

        if (!expense.isEditable()) {
            throw new BusinessException(
                    "INVALID_STATUS",
                    "Only draft or rejected expenses can be deleted");
        }

        expense.markDeleted();

        auditService.record(
                expense.getOrganizationId(),
                user.userId(),
                "DELETE",
                "EXPENSE",
                expense.getId());
    }

    @Transactional
    public ExpenseResponse submit(UUID id) {

        CurrentUser user =
                tenantAccess.requirePermission("EXPENSE_CREATE");

        Expense expense = requireVisible(id);

        if (!expense.isEditable()) {
            throw new BusinessException(
                    "INVALID_STATUS",
                    "Only draft or rejected expenses can be submitted");
        }

        if (expense.getAmount() == null
                || expense.getAmount().signum() <= 0) {

            throw new BusinessException(
                    "INVALID_AMOUNT",
                    "Expense amount must be greater than zero");
        }

        expense.submit();

        auditService.record(
                expense.getOrganizationId(),
                user.userId(),
                "UPDATE",
                "EXPENSE",
                expense.getId());

        /*
         * TEMPORARY FIX
         * ------------------------------------------------------------
         * ApprovalService currently does not expose:
         *
         *     openExpenseRequest(Expense, UUID)
         *
         * Therefore automatic creation of an approval workflow for
         * submitted expenses is temporarily disabled.
         *
         * The Expense itself is still moved to SUBMITTED status.
         * Audit logging and manager notification continue normally.
         *
         * Restore approval integration once ApprovalService API
         * is confirmed.
         * ------------------------------------------------------------
         */

        notifyManagerOnSubmit(expense, user);

        return ExpenseResponse.from(expense);
    }

    @Transactional
    public ExpenseResponse approve(UUID id) {

        CurrentUser user =
                tenantAccess.requirePermission("EXPENSE_APPROVE");

        Expense expense = requireVisible(id);

        if (!Expense.STATUS_SUBMITTED.equals(expense.getStatus())) {
            throw new BusinessException(
                    "INVALID_STATUS",
                    "Only submitted expenses can be approved");
        }

        expense.approve(user.userId());

        auditService.record(
                expense.getOrganizationId(),
                user.userId(),
                "APPROVE",
                "EXPENSE",
                expense.getId());

        /*
         * TEMPORARY FIX
         * ------------------------------------------------------------
         * ApprovalService.TARGET_EXPENSE does not currently exist.
         *
         * Approval synchronization is temporarily disabled.
         *
         * The Expense domain object itself is still approved and
         * the submitter is still notified.
         *
         * Restore something equivalent to:
         *
         * approvalService.syncApprove(...)
         *
         * once the correct approval target API/type is confirmed.
         * ------------------------------------------------------------
         */

        notifySubmitter(
                expense,
                "EXPENSE_APPROVED",
                "Expense approved",
                "Your expense was approved.");

        return ExpenseResponse.from(expense);
    }

    @Transactional
    public ExpenseResponse reject(
            UUID id,
            RejectExpenseRequest request) {

        CurrentUser user =
                tenantAccess.requirePermission("EXPENSE_APPROVE");

        Expense expense = requireVisible(id);

        if (!Expense.STATUS_SUBMITTED.equals(expense.getStatus())) {
            throw new BusinessException(
                    "INVALID_STATUS",
                    "Only submitted expenses can be rejected");
        }

        if (request == null
                || request.reason() == null
                || request.reason().isBlank()) {

            throw new BusinessException(
                    "INVALID_REASON",
                    "Rejection reason is required");
        }

        String reason = request.reason().trim();

        expense.reject(
                user.userId(),
                reason);

        auditService.record(
                expense.getOrganizationId(),
                user.userId(),
                "REJECT",
                "EXPENSE",
                expense.getId());

        /*
         * TEMPORARY FIX
         * ------------------------------------------------------------
         * ApprovalService.TARGET_EXPENSE does not currently exist.
         *
         * Approval synchronization is temporarily disabled.
         *
         * The Expense itself is still rejected and the submitter
         * receives the rejection notification.
         *
         * Restore approvalService.syncReject(...) after confirming
         * the ApprovalService target model.
         * ------------------------------------------------------------
         */

        notifySubmitter(
                expense,
                "EXPENSE_REJECTED",
                "Expense rejected",
                "Your expense was rejected: " + reason);

        return ExpenseResponse.from(expense);
    }

    private void notifyManagerOnSubmit(
            Expense expense,
            CurrentUser user) {

        if (expense.getResourceId() == null) {
            return;
        }

        Resource resource =
                resourceRepository
                        .findActiveById(expense.getResourceId())
                        .orElse(null);

        if (resource == null
                || resource.getManagerId() == null) {
            return;
        }

        String submitter =
                user.displayName() != null
                        ? user.displayName()
                        : user.email();

        notificationService.notify(
                expense.getOrganizationId(),
                resource.getManagerId(),
                "EXPENSE_SUBMITTED",
                "Expense submitted",
                submitter
                        + " submitted an expense for "
                        + expense.getCategory()
                        + ".",
                "EXPENSE",
                expense.getId());
    }

    private void notifySubmitter(
            Expense expense,
            String type,
            String title,
            String body) {

        UUID userId = expense.getCreatedBy();

        if (expense.getResourceId() != null) {

            Resource resource =
                    resourceRepository
                            .findActiveById(expense.getResourceId())
                            .orElse(null);

            if (resource != null
                    && resource.getUserId() != null) {

                userId = resource.getUserId();
            }
        }

        if (userId == null) {
            return;
        }

        notificationService.notify(
                expense.getOrganizationId(),
                userId,
                type,
                title,
                body,
                "EXPENSE",
                expense.getId());
    }

    private UUID resolveResourceId(
            UUID orgId,
            UUID resourceId,
            CurrentUser user) {

        if (resourceId != null) {

            Resource resource =
                    resourceRepository
                            .findActiveById(resourceId)
                            .orElseThrow(
                                    () ->
                                            new ResourceNotFoundException(
                                                    "Resource not found"));

            if (!orgId.equals(resource.getOrganizationId())) {
                throw new ResourceNotFoundException(
                        "Resource not found");
            }

            return resource.getId();
        }

        return resourceRepository
                .findActiveByUserId(user.userId())
                .filter(
                        resource ->
                                orgId.equals(
                                        resource.getOrganizationId()))
                .map(Resource::getId)
                .orElse(null);
    }

    private UUID resolveProjectId(
            UUID orgId,
            UUID projectId) {

        if (projectId == null) {
            return null;
        }

        Project project =
                projectRepository
                        .findActiveById(projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Project not found"));

        if (!orgId.equals(project.getOrganizationId())) {
            throw new ResourceNotFoundException(
                    "Project not found");
        }

        return project.getId();
    }

    private Expense requireVisible(UUID id) {

        Expense expense =
                expenseRepository
                        .findActiveById(id)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Expense not found"));

        tenantAccess.assertOrganizationVisible(
                expense.getOrganizationId());

        tenantAccess.assertRegionVisible(
                expense.getRegionId());

        return expense;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank()
                ? null
                : value.trim();
    }

    public record PageResult(
            List<ExpenseResponse> data,
            PaginationMeta pagination) {}
}

