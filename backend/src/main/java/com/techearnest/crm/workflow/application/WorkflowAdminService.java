package com.techearnest.crm.workflow.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.workflow.api.dto.WorkflowAdminDtos.WorkflowDefinitionResponse;
import com.techearnest.crm.workflow.domain.WorkflowDefinition;
import com.techearnest.crm.workflow.domain.WorkflowDefinitionRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowAdminService {

    private final WorkflowDefinitionRepository workflowDefinitionRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public WorkflowAdminService(
            WorkflowDefinitionRepository workflowDefinitionRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.workflowDefinitionRepository = workflowDefinitionRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<WorkflowDefinitionResponse> list(UUID organizationId) {
        tenantAccess.requirePermission("WORKFLOW_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        return workflowDefinitionRepository.findByOrganizationIdOrderByCodeAsc(orgId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public WorkflowDefinitionResponse setActive(UUID id, boolean active) {
        CurrentUser user = tenantAccess.requirePermission("WORKFLOW_MANAGE");
        WorkflowDefinition definition = workflowDefinitionRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(definition.getOrganizationId());
        definition.setActive(active);
        auditService.record(definition.getOrganizationId(), user.userId(), "UPDATE", "WORKFLOW_DEFINITION", id);
        return toResponse(definition);
    }

    private WorkflowDefinitionResponse toResponse(WorkflowDefinition definition) {
        return new WorkflowDefinitionResponse(
                definition.getId(),
                definition.getCode(),
                definition.getName(),
                definition.getEventType(),
                definition.isActive(),
                definition.getVersion());
    }
}
