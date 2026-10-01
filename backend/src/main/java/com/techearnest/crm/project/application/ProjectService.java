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
    private final ProjectCodeGenerator codeGenerator;

    public ProjectService(
            ProjectRepository projectRepository,
            ProjectTaskRepository projectTaskRepository,
            MilestoneRepository milestoneRepository,
            DealRepository dealRepository,
            AccountRepository accountRepository,
            RegionRepository regionRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            ProjectCodeGenerator codeGenerator) {
        this.codeGenerator = codeGenerator;
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

        String projectType = requireProjectType(request.projectType(), Project.TYPE_B2B);
        String billingType = requireBillingForType(projectType, requireBillingType(request.billingType()));
        UUID accountId = null;
        String accountName = null;
        if (request.accountId() != null && !Project.TYPE_IN_HOUSE.equals(projectType)) {
            Account account = accountRepository
                    .findActiveById(request.accountId())
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            if (!account.getOrganizationId().equals(orgId)) {
                throw new ResourceNotFoundException("Resource not found");
            }
            tenantAccess.assertRecordVisible(account);
            accountId = account.getId();
            accountName = account.getName();
        } else if (!Project.TYPE_IN_HOUSE.equals(projectType)) {
            throw accountRequired();
        }

        String code = blankToNull(request.projectCode());
        if (code == null) {
            code = codeGenerator.next(orgId, accountName, request.name());
        } else if (projectRepository.existsByOrganizationIdAndProjectCode(orgId, code)) {
            throw new ConflictException("Project code already exists");
        }

        UUID managerId = request.projectManagerId() != null ? request.projectManagerId() : user.userId();
        Project project = Project.create(
                orgId,
                region.getId(),
                accountId,
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
                billingType);
        project.classify(projectType, blankToNull(request.contractReference()), request.contractSignedDate());
        applyBillingTerms(project, request.hourlyRate(), request.monthlyFee(), request.contractValue());
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
                : codeGenerator.next(
                        deal.getOrganizationId(),
                        accountRepository.findById(deal.getAccountId()).map(Account::getName).orElse(null),
                        name);
        if (projectRepository.existsByOrganizationIdAndProjectCode(deal.getOrganizationId(), code)) {
            throw new ConflictException("Project code already exists");
        }

        UUID managerId = request != null && request.projectManagerId() != null
                ? request.projectManagerId()
                : user.userId();
        String billingType = request != null && request.billingType() != null && !request.billingType().isBlank()
                ? requireBillingForType(Project.TYPE_B2B, requireBillingType(request.billingType()))
                : Project.BILLING_FIXED_BID;

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
        project.applyBillingTerms(null, null, deal.getValue());
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
        String projectType = requireProjectType(request.projectType(), project.getProjectType());
        boolean inHouse = Project.TYPE_IN_HOUSE.equals(projectType);
        String requestedBilling = request.billingType() == null || request.billingType().isBlank()
                ? (inHouse ? Project.BILLING_NON_BILLABLE : project.getBillingType())
                : requireBillingType(request.billingType());
        String billingType = requireBillingForType(projectType, requestedBilling);
        UUID accountId = inHouse ? null : request.accountId();
        if (accountId != null) {
            Account account = accountRepository
                    .findActiveById(accountId)
                    .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
            tenantAccess.assertRecordVisible(account);
        } else if (!inHouse && project.getAccountId() == null) {
            throw accountRequired();
        }
        String previousBillingType = project.getBillingType();
        project.update(
                request.regionId(),
                accountId,
                request.projectManagerId(),
                request.name() != null ? request.name().trim() : null,
                request.description(),
                request.status(),
                blankToNull(request.priority()),
                request.startDate(),
                request.endDate(),
                request.budget(),
                request.estimatedHours(),
                billingType);
        if (request.projectType() == null) {
            project.classify(projectType, project.getContractReference(), project.getContractSignedDate());
        } else {
            project.classify(projectType, blankToNull(request.contractReference()), request.contractSignedDate());
        }
        boolean typeChanged = !project.getBillingType().equals(previousBillingType);
        boolean termsSent = request.hourlyRate() != null || request.monthlyFee() != null || request.contractValue() != null;
        if (typeChanged || termsSent) {
            applyBillingTerms(project, request.hourlyRate(), request.monthlyFee(), request.contractValue());
        }
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

    /** Preview of the code {@link #create} would assign; the final number is fixed only on save. */
    @Transactional(readOnly = true)
    public String suggestCode(UUID organizationId, UUID accountId, String projectType, String name) {
        tenantAccess.requirePermission("PROJECT_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        String accountName = null;
        if (accountId != null && !Project.TYPE_IN_HOUSE.equals(Project.normalizeProjectType(projectType))) {
            accountName = accountRepository.findActiveById(accountId)
                    .filter(account -> account.getOrganizationId().equals(orgId))
                    .map(Account::getName)
                    .orElse(null);
        }
        return codeGenerator.next(orgId, accountName, name);
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

    private static String requireBillingType(String value) {
        String type = Project.normalizeBillingType(value);
        if (type == null || !Project.BILLING_TYPES.contains(type)) {
            throw new BusinessException(
                    "INVALID_BILLING_TYPE", "Billing type must be one of " + String.join(", ", Project.BILLING_TYPES));
        }
        return type;
    }

    private static String requireProjectType(String value, String fallback) {
        String type = Project.normalizeProjectType(value);
        if (type == null) {
            return fallback;
        }
        if (!Project.PROJECT_TYPES.contains(type)) {
            throw new BusinessException(
                    "INVALID_PROJECT_TYPE", "Project type must be one of " + String.join(", ", Project.PROJECT_TYPES));
        }
        return type;
    }

    private static String requireBillingForType(String projectType, String billingType) {
        List<String> allowed = Project.allowedBillingTypes(projectType);
        if (!allowed.contains(billingType)) {
            throw new BusinessException(
                    "INVALID_BILLING_FOR_PROJECT_TYPE",
                    "Billing type for a " + projectType + " project must be one of " + String.join(", ", allowed));
        }
        return billingType;
    }

    private static BusinessException accountRequired() {
        return new BusinessException("ACCOUNT_REQUIRED", "Select the customer account for this project");
    }

    /** Each billing type needs the amount its invoices are generated from. */
    private static void applyBillingTerms(
            Project project, BigDecimal hourlyRate, BigDecimal monthlyFee, BigDecimal contractValue) {
        switch (project.getBillingType()) {
            case Project.BILLING_TIME_AND_MATERIAL -> requirePositive(hourlyRate, "HOURLY_RATE_REQUIRED",
                    "Enter the hourly rate for a time & material project");
            case Project.BILLING_FIXED_MONTHLY -> requirePositive(monthlyFee, "MONTHLY_FEE_REQUIRED",
                    "Enter the monthly fee for a fixed monthly project");
            case Project.BILLING_FIXED_BID -> {
                if (contractValue == null) {
                    contractValue = project.getBudget();
                }
                requirePositive(contractValue, "CONTRACT_VALUE_REQUIRED",
                        "Enter the contract value for a fixed bid project");
            }
            default -> {
                // Staff augmentation bills each resource's own rate; the project rate is only a fallback.
            }
        }
        project.applyBillingTerms(hourlyRate, monthlyFee, contractValue);
    }

    private static void requirePositive(BigDecimal value, String code, String message) {
        if (value == null || value.signum() <= 0) {
            throw new BusinessException(code, message);
        }
    }

    public record PageResult(List<ProjectResponse> data, PaginationMeta pagination) {}
}
