package com.techearnest.crm.workflow.api.dto;

import java.util.UUID;

public final class WorkflowAdminDtos {

    private WorkflowAdminDtos() {}

    public record WorkflowDefinitionResponse(
            UUID id, String code, String name, String eventType, boolean active, int version) {}

    public record ToggleWorkflowRequest(boolean active) {}
}
