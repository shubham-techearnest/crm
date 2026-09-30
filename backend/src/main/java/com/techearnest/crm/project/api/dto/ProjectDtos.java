package com.techearnest.crm.project.api.dto;

import com.techearnest.crm.project.domain.Milestone;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectTask;
import com.techearnest.crm.project.domain.TaskComment;
import com.techearnest.crm.project.domain.TaskDependency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class ProjectDtos {

    private ProjectDtos() {}

    public record ProjectResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID accountId,
            UUID dealId,
            UUID projectManagerId,
            String name,
            String projectCode,
            String description,
            String status,
            String priority,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal budget,
            BigDecimal estimatedHours,
            BigDecimal actualHours,
            String billingType,
            BigDecimal hourlyRate,
            BigDecimal monthlyFee,
            BigDecimal contractValue,
            BigDecimal progressPercent,
            String health,
            Long version,
            Instant createdAt,
            Instant updatedAt) {

        public static ProjectResponse from(Project project, BigDecimal progressPercent, String health) {
            return new ProjectResponse(
                    project.getId(),
                    project.getOrganizationId(),
                    project.getRegionId(),
                    project.getAccountId(),
                    project.getDealId(),
                    project.getProjectManagerId(),
                    project.getName(),
                    project.getProjectCode(),
                    project.getDescription(),
                    project.getStatus(),
                    project.getPriority(),
                    project.getStartDate(),
                    project.getEndDate(),
                    project.getBudget(),
                    project.getEstimatedHours(),
                    project.getActualHours(),
                    project.getBillingType(),
                    project.getHourlyRate(),
                    project.getMonthlyFee(),
                    project.getContractValue(),
                    progressPercent,
                    health,
                    project.getVersion(),
                    project.getCreatedAt(),
                    project.getUpdatedAt());
        }
    }

    public record CreateProjectRequest(
            UUID organizationId,
            @NotNull UUID regionId,
            @NotNull UUID accountId,
            UUID dealId,
            UUID projectManagerId,
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Size(max = 64) String projectCode,
            String description,
            @Size(max = 32) String status,
            @Size(max = 16) String priority,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal budget,
            BigDecimal estimatedHours,
            @NotBlank @Size(max = 32) String billingType,
            @PositiveOrZero BigDecimal hourlyRate,
            @PositiveOrZero BigDecimal monthlyFee,
            @PositiveOrZero BigDecimal contractValue) {}

    /** Billing amounts are left unchanged when the type is unchanged and none of them is sent. */
    public record UpdateProjectRequest(
            UUID regionId,
            UUID accountId,
            UUID projectManagerId,
            @Size(max = 255) String name,
            String description,
            @Size(max = 32) String status,
            @Size(max = 16) String priority,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal budget,
            BigDecimal estimatedHours,
            @Size(max = 32) String billingType,
            @PositiveOrZero BigDecimal hourlyRate,
            @PositiveOrZero BigDecimal monthlyFee,
            @PositiveOrZero BigDecimal contractValue) {}

    public record CreateProjectFromDealRequest(
            @Size(max = 255) String name,
            @Size(max = 64) String projectCode,
            UUID projectManagerId,
            @Size(max = 32) String billingType,
            LocalDate startDate,
            LocalDate endDate) {}

    public record MilestoneResponse(
            UUID id,
            UUID organizationId,
            UUID projectId,
            String name,
            String description,
            LocalDate dueDate,
            String status,
            int sortOrder,
            Instant createdAt,
            Instant updatedAt) {

        public static MilestoneResponse from(Milestone milestone) {
            return new MilestoneResponse(
                    milestone.getId(),
                    milestone.getOrganizationId(),
                    milestone.getProjectId(),
                    milestone.getName(),
                    milestone.getDescription(),
                    milestone.getDueDate(),
                    milestone.getStatus(),
                    milestone.getSortOrder(),
                    milestone.getCreatedAt(),
                    milestone.getUpdatedAt());
        }
    }

    public record CreateMilestoneRequest(
            @NotBlank @Size(max = 255) String name,
            String description,
            LocalDate dueDate,
            @Size(max = 32) String status,
            Integer sortOrder) {}

    public record UpdateMilestoneRequest(
            @Size(max = 255) String name,
            String description,
            LocalDate dueDate,
            @Size(max = 32) String status,
            Integer sortOrder) {}

    public record TaskResponse(
            UUID id,
            UUID organizationId,
            UUID projectId,
            UUID milestoneId,
            UUID parentTaskId,
            UUID assignedResourceId,
            String name,
            String description,
            String status,
            String priority,
            LocalDate startDate,
            LocalDate dueDate,
            BigDecimal estimatedHours,
            BigDecimal actualHours,
            BigDecimal completionPercentage,
            Long version,
            Instant createdAt,
            Instant updatedAt) {

        public static TaskResponse from(ProjectTask task) {
            return new TaskResponse(
                    task.getId(),
                    task.getOrganizationId(),
                    task.getProjectId(),
                    task.getMilestoneId(),
                    task.getParentTaskId(),
                    task.getAssignedResourceId(),
                    task.getName(),
                    task.getDescription(),
                    task.getStatus(),
                    task.getPriority(),
                    task.getStartDate(),
                    task.getDueDate(),
                    task.getEstimatedHours(),
                    task.getActualHours(),
                    task.getCompletionPercentage(),
                    task.getVersion(),
                    task.getCreatedAt(),
                    task.getUpdatedAt());
        }
    }

    public record CreateTaskRequest(
            UUID milestoneId,
            UUID parentTaskId,
            UUID assignedResourceId,
            @NotBlank @Size(max = 255) String name,
            String description,
            @Size(max = 32) String status,
            @Size(max = 16) String priority,
            LocalDate startDate,
            LocalDate dueDate,
            BigDecimal estimatedHours,
            BigDecimal completionPercentage) {}

    public record UpdateTaskRequest(
            UUID milestoneId,
            UUID parentTaskId,
            @Size(max = 255) String name,
            String description,
            @Size(max = 32) String status,
            @Size(max = 16) String priority,
            LocalDate startDate,
            LocalDate dueDate,
            BigDecimal estimatedHours,
            BigDecimal actualHours,
            BigDecimal completionPercentage) {}

    public record AssignTaskRequest(@NotNull UUID assignedResourceId) {}

    public record AddDependencyRequest(
            @NotNull UUID predecessorTaskId, @Size(max = 32) String type) {}

    public record DependencyResponse(
            UUID id, UUID organizationId, UUID predecessorTaskId, UUID successorTaskId, String type) {

        public static DependencyResponse from(TaskDependency dependency) {
            return new DependencyResponse(
                    dependency.getId(),
                    dependency.getOrganizationId(),
                    dependency.getPredecessorTaskId(),
                    dependency.getSuccessorTaskId(),
                    dependency.getType());
        }
    }

    public record CommentResponse(UUID id, UUID taskId, UUID authorId, String body, Instant createdAt) {

        public static CommentResponse from(TaskComment comment) {
            return new CommentResponse(
                    comment.getId(),
                    comment.getTaskId(),
                    comment.getAuthorId(),
                    comment.getBody(),
                    comment.getCreatedAt());
        }
    }

    public record CreateCommentRequest(@NotBlank String body) {}
}
