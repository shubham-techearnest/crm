package com.techearnest.crm.team.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.department.domain.Department;
import com.techearnest.crm.department.domain.DepartmentRepository;
import com.techearnest.crm.team.api.dto.TeamDtos.CreateTeamRequest;
import com.techearnest.crm.team.api.dto.TeamDtos.TeamResponse;
import com.techearnest.crm.team.api.dto.TeamDtos.UpdateTeamRequest;
import com.techearnest.crm.team.domain.Team;
import com.techearnest.crm.team.domain.TeamRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TeamService {

    private final TeamRepository teamRepository;
    private final DepartmentRepository departmentRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public TeamService(
            TeamRepository teamRepository,
            DepartmentRepository departmentRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.teamRepository = teamRepository;
        this.departmentRepository = departmentRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(UUID organizationId, String search, Pageable pageable) {
        tenantAccess.requirePermission("TEAM_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Page<Team> page = teamRepository.search(orgId, blankToNull(search), pageable);
        return new PageResult(page.map(TeamResponse::from).getContent(), PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public TeamResponse get(UUID id) {
        tenantAccess.requirePermission("TEAM_VIEW");
        Team team = requireVisibleTeam(id);
        return TeamResponse.from(team);
    }

    @Transactional
    public TeamResponse create(CreateTeamRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TEAM_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        Department department = requireDepartmentInOrg(request.departmentId(), orgId);
        Team team = Team.create(orgId, department.getId(), request.name().trim(), request.managerId());
        teamRepository.save(team);
        auditService.record(orgId, user.userId(), "CREATE", "TEAM", team.getId());
        return TeamResponse.from(team);
    }

    @Transactional
    public TeamResponse update(UUID id, UpdateTeamRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TEAM_MANAGE");
        Team team = requireVisibleTeam(id);
        UUID departmentId = request.departmentId() != null ? request.departmentId() : team.getDepartmentId();
        Department department = requireDepartmentInOrg(departmentId, team.getOrganizationId());
        team.update(request.name().trim(), department.getId(), request.managerId());
        auditService.record(team.getOrganizationId(), user.userId(), "UPDATE", "TEAM", team.getId());
        return TeamResponse.from(team);
    }

    private Team requireVisibleTeam(UUID id) {
        Team team = teamRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(team.getOrganizationId());
        return team;
    }

    private Department requireDepartmentInOrg(UUID departmentId, UUID organizationId) {
        Department department = departmentRepository
                .findActiveById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!department.getOrganizationId().equals(organizationId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return department;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<TeamResponse> data, PaginationMeta pagination) {}
}
