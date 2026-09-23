package com.techearnest.crm.project.application;

import com.techearnest.crm.account.domain.Account;
import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.deal.domain.Deal;
import com.techearnest.crm.deal.domain.DealRepository;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateProjectFromDealRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateProjectRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.ProjectResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.UpdateProjectRequest;
import com.techearnest.crm.project.domain.Milestone;
import com.techearnest.crm.project.domain.MilestoneRepository;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.project.domain.ProjectTask;
import com.techearnest.crm.project.domain.ProjectTaskRepository;
import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.region.domain.RegionRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectTaskRepository projectTaskRepository;
    private final MilestoneRepository milestoneRepository;
    private final DealRepository dealRepository;
    private final AccountRepository accountRepository;
    private final RegionRepository regionRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public ProjectService(
            ProjectRepository projectRepository,
            ProjectTaskRepository projectTaskRepository,
            MilestoneRepository milestoneRepository,
            DealRepository dealRepository,
            AccountRepository accountRepository,
            RegionRepository regionRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.projectRepository = projectRepository;
        this.projectTaskRepository = projectTaskRepository;
        this.milestoneRepository = milestoneRepository;
        this.dealRepository = dealRepository;
        this.accountRepository = accountRepository;
        this.regionRepository = regionRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String search,
            String status,
            UUID accountId,
            UUID projectManagerId,
            java.time.LocalDate startFrom,
            java.time.LocalDate endTo,
            boolean delayedOnly,
            Pageable pageable) {
        tenantAccess.requirePermission("PROJECT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        Collection<UUID> managerIds = tenantAccess.ownerIdsFilterOrNull();
        Page<Project> page = projectRepository.search(
                orgId,
                blankToNull(search),
                regionIds,
                managerIds,
                blankToNull(status),
                accountId,
                projectManagerId,
                startFrom,
                endTo,
                delayedOnly,
                pageable);
        List<ProjectResponse> data =
                page.getContent().stream().map(this::toResponse).toList();
        return new PageResult(data, PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public ProjectResponse get(UUID id) {
        tenantAccess.requirePermission("PROJECT_VIEW");
        return toResponse(requireVisibleProject(id));
    }

    @Transactional
    public ProjectResponse create(CreateProjectRequest request) {
        CurrentUser user = tenantAccess.requirePermission("PROJECT_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        Region region = requireRegionInOrg(request.regionId(), orgId);
        tenantAccess.assertRegionVisible(region.getId());

        Account account = accountRepository
                .findActiveById(request.accountId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!account.getOrganizationId().equals(orgId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        tenantAccess.assertRecordVisible(account);

        String code = request.projectCode().trim();
        if (projectRepository.existsByOrganizationIdAndProjectCode(orgId, code)) {
            throw new ConflictException("Project code already exists");
        }

        UUID managerId = request.projectManagerId() != null ? request.projectManagerId() : user.userId();
        Project project = Project.create(
                orgId,
                region.getId(),
                account.getId(),
                request.dealId(),
                managerId,
                request.name().trim(),
                code,
                request.description(),
                request.status(),
                blankToNull(request.priority()),
                request.startDate(),
                request.endDate(),
                request.budget(),
                request.estimatedHours(),
                request.billingType().trim());
        projectRepository.save(project);
        auditService.record(orgId, user.userId(), "CREATE", "PROJECT", project.getId());
        return toResponse(project);
    }

    @Transactional
    public ProjectResponse createFromDeal(UUID dealId, CreateProjectFromDealRequest request) {
        CurrentUser user = tenantAccess.requirePermission("PROJECT_CREATE");
        Deal deal = dealRepository
                .findActiveById(dealId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(deal);

        if (!"WON".equals(deal.getStage())) {
            throw new BusinessException("DEAL_NOT_WON", "Deal must be WON to create a project");
        }
        if (projectRepository.findByDealIdAndDeletedAtIsNull(dealId).isPresent()) {
            throw new ConflictException("Project already exists for this deal");
        }

        String name = request != null && request.name() != null && !request.name().isBlank()
                ? request.name().trim()
                : deal.getName();
        String code = request != null && request.projectCode() != null && !request.projectCode().isBlank()
                ? request.projectCode().trim()
                : generateProjectCode(deal.getOrganizationId(), deal.getName());
        if (projectRepository.existsByOrganizationIdAndProjectCode(deal.getOrganizationId(), code)) {
            throw new ConflictException("Project code already exists");
        }

        UUID managerId = request != null && request.projectManagerId() != null
                ? request.projectManagerId()
                : user.userId();
        String billingType = request != null && request.billingType() != null && !request.billingType().isBlank()
                ? request.billingType().trim()
                : "FIXED_PRICE";

        Project project = Project.create(
                deal.getOrganizationId(),
                deal.getRegionId(),
                deal.getAccountId(),
                deal.getId(),
                managerId,
                name,
                code,
                deal.getDescription(),
                "ACTIVE",
                null,
                request != null ? request.startDate() : null,
                request != null ? request.endDate() : null,
                null,
                null,
                billingType);
        projectRepository.save(project);
        auditService.record(deal.getOrganizationId(), user.userId(), "CREATE", "PROJECT", project.getId());
        return toResponse(project);
    }

    @Transactional
    public ProjectResponse update(UUID id, UpdateProjectRequest request) {
        CurrentUser user = tenantAccess.requirePermission("PROJECT_UPDATE");
        Project project = requireVisibleProject(id);
        if (request.regionId() != null) {
            Region region = requireRegionInOrg(request.regionId(), project.getOrganizationId());
            tenantAccess.assertRegionVisible(region.getId());
        }
        if (request.accountId() != null) {
            Account account = accountRepository
                    .findActiveById(request.accountId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            tenantAccess.assertRecordVisible(account);
        }
        project.update(
                request.regionId(),
                request.accountId(),
                request.projectManagerId(),
                request.name() != null ? request.name().trim() : null,
                request.description(),
                request.status(),
                blankToNull(request.priority()),
                request.startDate(),
                request.endDate(),
                request.budget(),
                request.estimatedHours(),
                blankToNull(request.billingType()));
        auditService.record(project.getOrganizationId(), user.userId(), "UPDATE", "PROJECT", project.getId());
        return toResponse(project);
    }

    @Transactional
    public void softDelete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("PROJECT_DELETE");
        Project project = requireVisibleProject(id);
        project.markDeleted();
        auditService.record(project.getOrganizationId(), user.userId(), "DELETE", "PROJECT", project.getId());
    }

    public BigDecimal computeProgressPercent(UUID projectId) {
        List<ProjectTask> tasks = projectTaskRepository.findByProjectId(projectId).stream()
                .filter(t -> !"CANCELLED".equals(t.getStatus()))
                .toList();
        if (tasks.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = tasks.stream()
                .map(ProjectTask::getCompletionPercentage)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(tasks.size()), 2, RoundingMode.HALF_UP);
    }

    Project requireVisibleProject(UUID id) {
        Project project = projectRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(project);
        return project;
    }

    private ProjectResponse toResponse(Project project) {
        return ProjectResponse.from(
                project, computeProgressPercent(project.getId()), computeHealth(project));
    }

    private String computeHealth(Project project) {
        String status = project.getStatus() == null ? "" : project.getStatus().toUpperCase(Locale.ROOT);
        if (Set.of("COMPLETED", "CANCELLED").contains(status)) {
            return "ON_TRACK";
        }
        LocalDate today = LocalDate.now();
        if (project.getEndDate() != null && project.getEndDate().isBefore(today)) {
            return "DELAYED";
        }
        boolean overdueMilestone = milestoneRepository.findByProjectId(project.getId()).stream()
                .anyMatch(m -> {
                    String ms = m.getStatus() == null ? "" : m.getStatus().toUpperCase(Locale.ROOT);
                    return m.getDueDate() != null
                            && m.getDueDate().isBefore(today)
                            && !Set.of("COMPLETED", "DONE", "CANCELLED").contains(ms);
                });
        return overdueMilestone ? "DELAYED" : "ON_TRACK";
    }

    private String generateProjectCode(UUID organizationId, String dealName) {
        String base = dealName == null || dealName.isBlank()
                ? "PRJ"
                : dealName.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "-");
        if (base.length() > 40) {
            base = base.substring(0, 40);
        }
        if (base.endsWith("-")) {
            base = base.substring(0, base.length() - 1);
        }
        if (base.isBlank()) {
            base = "PRJ";
        }
        String candidate = base;
        int suffix = 1;
        while (projectRepository.existsByOrganizationIdAndProjectCode(organizationId, candidate)) {
            String suffixStr = "-" + suffix;
            int maxBase = Math.max(1, 64 - suffixStr.length());
            candidate = (base.length() > maxBase ? base.substring(0, maxBase) : base) + suffixStr;
            suffix++;
        }
        return candidate;
    }

    private Region requireRegionInOrg(UUID regionId, UUID organizationId) {
        Region region = regionRepository
                .findActiveById(regionId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!region.getOrganizationId().equals(organizationId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return region;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record PageResult(List<ProjectResponse> data, PaginationMeta pagination) {}
}
