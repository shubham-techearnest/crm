package com.techearnest.crm.workflow.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.workflow.api.dto.WorkflowAdminDtos.ToggleWorkflowRequest;
import com.techearnest.crm.workflow.api.dto.WorkflowAdminDtos.WorkflowDefinitionResponse;
import com.techearnest.crm.workflow.application.WorkflowAdminService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/workflows")
public class WorkflowAdminController {

    private final WorkflowAdminService workflowAdminService;

    public WorkflowAdminController(WorkflowAdminService workflowAdminService) {
        this.workflowAdminService = workflowAdminService;
    }

    @GetMapping
    public ApiResponse<List<WorkflowDefinitionResponse>> list(
            @RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(workflowAdminService.list(organizationId));
    }

    @PutMapping("/{id}/active")
    public ApiResponse<WorkflowDefinitionResponse> setActive(
            @PathVariable UUID id, @Valid @RequestBody ToggleWorkflowRequest request) {
        return ApiResponse.ok(workflowAdminService.setActive(id, request.active()));
    }
}
