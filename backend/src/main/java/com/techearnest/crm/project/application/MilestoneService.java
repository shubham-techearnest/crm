package com.techearnest.crm.project.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateMilestoneRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.MilestoneResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.UpdateMilestoneRequest;
import com.techearnest.crm.project.domain.Milestone;
import com.techearnest.crm.project.domain.MilestoneRepository;
import com.techearnest.crm.project.domain.Project;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MilestoneService {

    private final MilestoneRepository milestoneRepository;
    private final ProjectService projectService;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public MilestoneService(
            MilestoneRepository milestoneRepository,
            ProjectService projectService,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.milestoneRepository = milestoneRepository;
        this.projectService = projectService;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<MilestoneResponse> listByProject(UUID projectId) {
        tenantAccess.requirePermission("MILESTONE_VIEW");
        projectService.requireVisibleProject(projectId);
        return milestoneRepository.findByProjectId(projectId).stream()
                .map(MilestoneResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            UUID projectId,
            String status,
            java.time.LocalDate dueFrom,
            java.time.LocalDate dueTo,
            org.springframework.data.domain.Pageable pageable) {
        tenantAccess.requirePermission("MILESTONE_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        java.util.Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        java.util.Collection<UUID> managerIds = tenantAccess.ownerIdsFilterOrNull();
        var page = milestoneRepository.search(
                orgId,
                regionIds,
                managerIds,
                projectId,
                blankToNull(status),
                dueFrom,
                dueTo,
                pageable);
        return new PageResult(
                page.map(MilestoneResponse::from).getContent(),
                com.techearnest.crm.common.api.PaginationMeta.from(page));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(
            List<MilestoneResponse> data, com.techearnest.crm.common.api.PaginationMeta pagination) {}

    @Transactional(readOnly = true)
    public MilestoneResponse get(UUID id) {
        tenantAccess.requirePermission("MILESTONE_VIEW");
        return MilestoneResponse.from(requireVisibleMilestone(id));
    }

    @Transactional
    public MilestoneResponse create(UUID projectId, CreateMilestoneRequest request) {
        CurrentUser user = tenantAccess.requirePermission("MILESTONE_MANAGE");
        Project project = projectService.requireVisibleProject(projectId);
        Milestone milestone = Milestone.create(
                project.getOrganizationId(),
                project.getId(),
                request.name().trim(),
                request.description(),
                request.dueDate(),
                request.status(),
                request.sortOrder());
        milestoneRepository.save(milestone);
        auditService.record(project.getOrganizationId(), user.userId(), "CREATE", "MILESTONE", milestone.getId());
        return MilestoneResponse.from(milestone);
    }

    @Transactional
    public MilestoneResponse update(UUID id, UpdateMilestoneRequest request) {
        CurrentUser user = tenantAccess.requirePermission("MILESTONE_MANAGE");
        Milestone milestone = requireVisibleMilestone(id);
        milestone.update(
                request.name() != null ? request.name().trim() : null,
                request.description(),
                request.dueDate(),
                request.status(),
                request.sortOrder());
        auditService.record(
                milestone.getOrganizationId(), user.userId(), "UPDATE", "MILESTONE", milestone.getId());
        return MilestoneResponse.from(milestone);
    }

    Milestone requireVisibleMilestone(UUID id) {
        Milestone milestone = milestoneRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        projectService.requireVisibleProject(milestone.getProjectId());
        return milestone;
    }
}
