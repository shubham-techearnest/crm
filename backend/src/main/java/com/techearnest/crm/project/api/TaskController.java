package com.techearnest.crm.project.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.AddDependencyRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.AssignTaskRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.CommentResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateCommentRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.DependencyResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.TaskResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.UpdateTaskRequest;
import com.techearnest.crm.project.application.TaskService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public ApiResponse<List<TaskResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID assignedResourceId,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    java.time.LocalDate dueFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    java.time.LocalDate dueTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = taskService.list(
                organizationId,
                projectId,
                status,
                assignedResourceId,
                priority,
                dueFrom,
                dueTo,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(taskService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TaskResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateTaskRequest request) {
        return ApiResponse.ok(taskService.update(id, request), "Task updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        taskService.softDelete(id);
        return ApiResponse.ok(null, "Task deleted successfully");
    }

    @PostMapping("/bulk-status")
    public ApiResponse<com.techearnest.crm.common.bulk.BulkDtos.BulkResult> bulkStatus(
            @Valid @RequestBody com.techearnest.crm.common.bulk.BulkDtos.BulkStatusRequest request) {
        return ApiResponse.ok(taskService.bulkStatus(request), "Bulk status update completed");
    }

    @PostMapping("/{id}/assign")
    public ApiResponse<TaskResponse> assign(
            @PathVariable UUID id, @Valid @RequestBody AssignTaskRequest request) {
        return ApiResponse.ok(taskService.assign(id, request), "Task assigned successfully");
    }

    @PostMapping("/{id}/dependencies")
    public ApiResponse<DependencyResponse> addDependency(
            @PathVariable UUID id, @Valid @RequestBody AddDependencyRequest request) {
        return ApiResponse.ok(taskService.addDependency(id, request), "Dependency added successfully");
    }

    @GetMapping("/{id}/comments")
    public ApiResponse<List<CommentResponse>> listComments(@PathVariable UUID id) {
        return ApiResponse.ok(taskService.listComments(id));
    }

    @PostMapping("/{id}/comments")
    public ApiResponse<CommentResponse> addComment(
            @PathVariable UUID id, @Valid @RequestBody CreateCommentRequest request) {
        return ApiResponse.ok(taskService.addComment(id, request), "Comment added successfully");
    }
}
