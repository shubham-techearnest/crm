package com.techearnest.crm.project.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateMilestoneRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateProjectRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateTaskRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.MilestoneResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.ProjectResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.TaskResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.UpdateProjectRequest;
import com.techearnest.crm.project.application.MilestoneService;
import com.techearnest.crm.project.application.ProjectService;
import com.techearnest.crm.project.application.TaskService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectService projectService;
    private final MilestoneService milestoneService;
    private final TaskService taskService;

    public ProjectController(
            ProjectService projectService, MilestoneService milestoneService, TaskService taskService) {
        this.projectService = projectService;
        this.milestoneService = milestoneService;
        this.taskService = taskService;
    }

    @GetMapping
    public ApiResponse<List<ProjectResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) UUID projectManagerId,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
                    java.time.LocalDate startFrom,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
                    java.time.LocalDate endTo,
            @RequestParam(required = false, defaultValue = "false") boolean delayedOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = projectService.list(
                organizationId,
                search,
                status,
                accountId,
                projectManagerId,
                startFrom,
                endTo,
                delayedOnly,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<ProjectResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(projectService.get(id));
    }

    @PostMapping
    public ApiResponse<ProjectResponse> create(@Valid @RequestBody CreateProjectRequest request) {
        return ApiResponse.ok(projectService.create(request), "Project created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<ProjectResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateProjectRequest request) {
        return ApiResponse.ok(projectService.update(id, request), "Project updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        projectService.softDelete(id);
        return ApiResponse.ok(null, "Project deleted successfully");
    }

    @GetMapping("/{id}/milestones")
    public ApiResponse<List<MilestoneResponse>> listMilestones(@PathVariable UUID id) {
        return ApiResponse.ok(milestoneService.listByProject(id));
    }

    @PostMapping("/{id}/milestones")
    public ApiResponse<MilestoneResponse> createMilestone(
            @PathVariable UUID id, @Valid @RequestBody CreateMilestoneRequest request) {
        return ApiResponse.ok(milestoneService.create(id, request), "Milestone created successfully");
    }

    @GetMapping("/{id}/tasks")
    public ApiResponse<List<TaskResponse>> listTasks(@PathVariable UUID id) {
        return ApiResponse.ok(taskService.listByProject(id));
    }

    @PostMapping("/{id}/tasks")
    public ApiResponse<TaskResponse> createTask(
            @PathVariable UUID id, @Valid @RequestBody CreateTaskRequest request) {
        return ApiResponse.ok(taskService.create(id, request), "Task created successfully");
    }
}
