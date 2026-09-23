package com.techearnest.crm.project.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.project.api.dto.ProjectDtos.AddDependencyRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.AssignTaskRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.CommentResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateCommentRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateTaskRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.DependencyResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.TaskResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.UpdateTaskRequest;
import com.techearnest.crm.project.domain.Milestone;
import com.techearnest.crm.project.domain.MilestoneRepository;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectTask;
import com.techearnest.crm.project.domain.ProjectTaskRepository;
import com.techearnest.crm.project.domain.TaskComment;
import com.techearnest.crm.project.domain.TaskCommentRepository;
import com.techearnest.crm.project.domain.TaskDependency;
import com.techearnest.crm.project.domain.TaskDependencyRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskService {

    private final ProjectTaskRepository projectTaskRepository;
    private final TaskDependencyRepository taskDependencyRepository;
    private final TaskCommentRepository taskCommentRepository;
    private final MilestoneRepository milestoneRepository;
    private final ProjectService projectService;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public TaskService(
            ProjectTaskRepository projectTaskRepository,
            TaskDependencyRepository taskDependencyRepository,
            TaskCommentRepository taskCommentRepository,
            MilestoneRepository milestoneRepository,
            ProjectService projectService,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.projectTaskRepository = projectTaskRepository;
        this.taskDependencyRepository = taskDependencyRepository;
        this.taskCommentRepository = taskCommentRepository;
        this.milestoneRepository = milestoneRepository;
        this.projectService = projectService;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> listByProject(UUID projectId) {
        tenantAccess.requirePermission("TASK_VIEW");
        projectService.requireVisibleProject(projectId);
        return projectTaskRepository.findByProjectId(projectId).stream()
                .map(TaskResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            UUID projectId,
            String status,
            UUID assignedResourceId,
            String priority,
            java.time.LocalDate dueFrom,
            java.time.LocalDate dueTo,
            org.springframework.data.domain.Pageable pageable) {
        tenantAccess.requirePermission("TASK_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        java.util.Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        java.util.Collection<UUID> managerIds = tenantAccess.ownerIdsFilterOrNull();
        var page = projectTaskRepository.search(
                orgId,
                regionIds,
                managerIds,
                projectId,
                blankToNull(status),
                assignedResourceId,
                blankToNull(priority),
                dueFrom,
                dueTo,
                pageable);
        return new PageResult(
                page.map(TaskResponse::from).getContent(),
                com.techearnest.crm.common.api.PaginationMeta.from(page));
    }

    public record PageResult(
            List<TaskResponse> data, com.techearnest.crm.common.api.PaginationMeta pagination) {}

    @Transactional(readOnly = true)
    public TaskResponse get(UUID id) {
        tenantAccess.requirePermission("TASK_VIEW");
        return TaskResponse.from(requireVisibleTask(id));
    }

    @Transactional
    public TaskResponse create(UUID projectId, CreateTaskRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TASK_CREATE");
        Project project = projectService.requireVisibleProject(projectId);
        validateMilestone(request.milestoneId(), project);
        validateParent(request.parentTaskId(), project);

        ProjectTask task = ProjectTask.create(
                project.getOrganizationId(),
                project.getId(),
                request.milestoneId(),
                request.parentTaskId(),
                request.assignedResourceId(),
                request.name().trim(),
                request.description(),
                request.status(),
                blankToNull(request.priority()),
                request.startDate(),
                request.dueDate(),
                request.estimatedHours(),
                request.completionPercentage());
        projectTaskRepository.save(task);
        auditService.record(project.getOrganizationId(), user.userId(), "CREATE", "TASK", task.getId());
        if (request.assignedResourceId() != null) {
            auditService.record(project.getOrganizationId(), user.userId(), "ASSIGN", "TASK", task.getId());
        }
        recalculateParentProgress(task.getParentTaskId());
        return TaskResponse.from(task);
    }

    @Transactional
    public TaskResponse update(UUID id, UpdateTaskRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TASK_UPDATE");
        ProjectTask task = requireVisibleTask(id);
        Project project = projectService.requireVisibleProject(task.getProjectId());
        validateMilestone(request.milestoneId(), project);
        validateParent(request.parentTaskId(), project);
        if (request.parentTaskId() != null && request.parentTaskId().equals(task.getId())) {
            throw new BusinessException("INVALID_PARENT", "Task cannot be its own parent");
        }

        UUID previousParent = task.getParentTaskId();
        task.update(
                request.milestoneId(),
                request.parentTaskId(),
                request.name() != null ? request.name().trim() : null,
                request.description(),
                request.status(),
                blankToNull(request.priority()),
                request.startDate(),
                request.dueDate(),
                request.estimatedHours(),
                request.actualHours(),
                request.completionPercentage());
        auditService.record(task.getOrganizationId(), user.userId(), "UPDATE", "TASK", task.getId());
        recalculateParentProgress(previousParent);
        recalculateParentProgress(task.getParentTaskId());
        return TaskResponse.from(task);
    }

    @Transactional
    public void softDelete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("TASK_DELETE");
        ProjectTask task = requireVisibleTask(id);
        UUID parentId = task.getParentTaskId();
        task.markDeleted();
        auditService.record(task.getOrganizationId(), user.userId(), "DELETE", "TASK", task.getId());
        recalculateParentProgress(parentId);
    }

    @Transactional
    public TaskResponse assign(UUID id, AssignTaskRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TASK_ASSIGN");
        ProjectTask task = requireVisibleTask(id);
        task.assign(request.assignedResourceId());
        auditService.record(task.getOrganizationId(), user.userId(), "ASSIGN", "TASK", task.getId());
        return TaskResponse.from(task);
    }

    @Transactional
    public DependencyResponse addDependency(UUID taskId, AddDependencyRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TASK_UPDATE");
        ProjectTask successor = requireVisibleTask(taskId);
        if (request.predecessorTaskId().equals(taskId)) {
            throw new BusinessException("INVALID_DEPENDENCY", "Task cannot depend on itself");
        }
        ProjectTask predecessor = projectTaskRepository
                .findActiveById(request.predecessorTaskId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!predecessor.getProjectId().equals(successor.getProjectId())) {
            throw new BusinessException("INVALID_DEPENDENCY", "Tasks must belong to the same project");
        }
        projectService.requireVisibleProject(predecessor.getProjectId());
        if (taskDependencyRepository.existsByPredecessorTaskIdAndSuccessorTaskId(
                request.predecessorTaskId(), taskId)) {
            throw new ConflictException("Dependency already exists");
        }

        TaskDependency dependency = TaskDependency.create(
                successor.getOrganizationId(),
                request.predecessorTaskId(),
                taskId,
                request.type());
        taskDependencyRepository.save(dependency);
        auditService.record(
                successor.getOrganizationId(), user.userId(), "UPDATE", "TASK", successor.getId());
        return DependencyResponse.from(dependency);
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> listComments(UUID taskId) {
        tenantAccess.requirePermission("TASK_VIEW");
        requireVisibleTask(taskId);
        return taskCommentRepository.findByTaskId(taskId).stream()
                .map(CommentResponse::from)
                .toList();
    }

    @Transactional
    public CommentResponse addComment(UUID taskId, CreateCommentRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TASK_UPDATE");
        ProjectTask task = requireVisibleTask(taskId);
        TaskComment comment = TaskComment.create(
                task.getOrganizationId(), task.getId(), user.userId(), request.body().trim());
        taskCommentRepository.save(comment);
        auditService.record(task.getOrganizationId(), user.userId(), "UPDATE", "TASK", task.getId());
        return CommentResponse.from(comment);
    }

    private void recalculateParentProgress(UUID parentTaskId) {
        if (parentTaskId == null) {
            return;
        }
        ProjectTask parent = projectTaskRepository.findActiveById(parentTaskId).orElse(null);
        if (parent == null) {
            return;
        }
        List<ProjectTask> children = projectTaskRepository.findByParentTaskId(parentTaskId).stream()
                .filter(t -> !"CANCELLED".equals(t.getStatus()))
                .toList();
        if (children.isEmpty()) {
            return;
        }
        BigDecimal sum = children.stream()
                .map(ProjectTask::getCompletionPercentage)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal avg = sum.divide(BigDecimal.valueOf(children.size()), 2, RoundingMode.HALF_UP);
        parent.setCompletionPercentage(avg);
        if (avg.compareTo(new BigDecimal("100")) == 0) {
            parent.update(
                    parent.getMilestoneId(),
                    parent.getParentTaskId(),
                    parent.getName(),
                    parent.getDescription(),
                    "COMPLETED",
                    parent.getPriority(),
                    parent.getStartDate(),
                    parent.getDueDate(),
                    parent.getEstimatedHours(),
                    parent.getActualHours(),
                    null);
        }
        recalculateParentProgress(parent.getParentTaskId());
    }

    private void validateMilestone(UUID milestoneId, Project project) {
        if (milestoneId == null) {
            return;
        }
        Milestone milestone = milestoneRepository
                .findActiveById(milestoneId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!milestone.getProjectId().equals(project.getId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
    }

    private void validateParent(UUID parentTaskId, Project project) {
        if (parentTaskId == null) {
            return;
        }
        ProjectTask parent = projectTaskRepository
                .findActiveById(parentTaskId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!parent.getProjectId().equals(project.getId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
    }

    private ProjectTask requireVisibleTask(UUID id) {
        ProjectTask task = projectTaskRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        projectService.requireVisibleProject(task.getProjectId());
        return task;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
