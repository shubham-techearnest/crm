package com.techearnest.crm.dashboard.application;

import com.techearnest.crm.account.domain.AccountRepository;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.dashboard.api.dto.DashboardDtos.DashboardResponse;
import com.techearnest.crm.dashboard.api.dto.DashboardDtos.NamedCount;
import com.techearnest.crm.dashboard.api.dto.DashboardDtos.NamedValue;
import com.techearnest.crm.deal.domain.Deal;
import com.techearnest.crm.deal.domain.DealRepository;
import com.techearnest.crm.lead.domain.Lead;
import com.techearnest.crm.lead.domain.LeadRepository;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.project.domain.ProjectTask;
import com.techearnest.crm.project.domain.ProjectTaskRepository;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocation;
import com.techearnest.crm.resource.domain.ResourceAllocationRepository;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.timesheet.domain.TimeEntry;
import com.techearnest.crm.timesheet.domain.TimeEntryRepository;
import com.techearnest.crm.timesheet.domain.Timesheet;
import com.techearnest.crm.timesheet.domain.TimesheetRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    private static final Set<String> OPEN_STAGES =
            Set.of("NEW", "QUALIFICATION", "REQUIREMENT", "PROPOSAL", "NEGOTIATION");

    private final LeadRepository leadRepository;
    private final DealRepository dealRepository;
    private final AccountRepository accountRepository;
    private final ProjectRepository projectRepository;
    private final ProjectTaskRepository projectTaskRepository;
    private final ResourceRepository resourceRepository;
    private final ResourceAllocationRepository allocationRepository;
    private final TimesheetRepository timesheetRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final TenantAccess tenantAccess;

    public DashboardService(
            LeadRepository leadRepository,
            DealRepository dealRepository,
            AccountRepository accountRepository,
            ProjectRepository projectRepository,
            ProjectTaskRepository projectTaskRepository,
            ResourceRepository resourceRepository,
            ResourceAllocationRepository allocationRepository,
            TimesheetRepository timesheetRepository,
            TimeEntryRepository timeEntryRepository,
            TenantAccess tenantAccess) {
        this.leadRepository = leadRepository;
        this.dealRepository = dealRepository;
        this.accountRepository = accountRepository;
        this.projectRepository = projectRepository;
        this.projectTaskRepository = projectTaskRepository;
        this.resourceRepository = resourceRepository;
        this.allocationRepository = allocationRepository;
        this.timesheetRepository = timesheetRepository;
        this.timeEntryRepository = timeEntryRepository;
        this.tenantAccess = tenantAccess;
    }

    @Transactional(readOnly = true)
    public DashboardResponse organization(UUID organizationId) {
        tenantAccess.requirePermission("DASHBOARD_ORG");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Scope scope = scope(orgId, null, true);
        return buildCrmProjectTimeDashboard("Organization", scope);
    }

    @Transactional(readOnly = true)
    public DashboardResponse region(UUID organizationId, UUID regionId) {
        tenantAccess.requirePermission("DASHBOARD_REGION");
        if (regionId == null) {
            throw new BusinessException("REGION_REQUIRED", "regionId is required");
        }
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Scope scope = scope(orgId, regionId, true);
        return buildCrmProjectTimeDashboard("Region", scope);
    }

    @Transactional(readOnly = true)
    public DashboardResponse sales(UUID organizationId) {
        tenantAccess.requirePermission("DASHBOARD_SALES");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Scope scope = scope(orgId, null, true);
        List<Lead> leads = loadLeads(scope);
        List<Deal> deals = loadDeals(scope);

        BigDecimal won = deals.stream()
                .filter(d -> "WON".equals(d.getStage()))
                .map(d -> nullToZero(d.getValue()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal forecast = deals.stream()
                .filter(d -> OPEN_STAGES.contains(d.getStage()))
                .map(this::forecastValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long openDeals = deals.stream().filter(d -> OPEN_STAGES.contains(d.getStage())).count();

        List<NamedValue> cards = List.of(
                card("Leads", BigDecimal.valueOf(leads.size())),
                card("Open deals", BigDecimal.valueOf(openDeals)),
                card("Won revenue", won),
                card("Pipeline forecast", forecast));

        return new DashboardResponse(
                cards, countBy(leads, Lead::getStatus), countBy(deals, Deal::getStage), "Sales");
    }

    @Transactional(readOnly = true)
    public DashboardResponse project(UUID organizationId) {
        tenantAccess.requirePermission("DASHBOARD_PROJECT");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Scope scope = scope(orgId, null, false);
        List<Project> projects = loadProjects(scope);

        BigDecimal estimated = projects.stream()
                .map(p -> nullToZero(p.getEstimatedHours()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal actual = projects.stream()
                .map(p -> nullToZero(p.getActualHours()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long active = projects.stream().filter(p -> "ACTIVE".equals(p.getStatus())).count();
        BigDecimal budget = projects.stream()
                .map(p -> nullToZero(p.getBudget()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<NamedValue> cards = List.of(
                card("Projects", BigDecimal.valueOf(projects.size())),
                card("Active", BigDecimal.valueOf(active)),
                card("Estimated hours", estimated),
                card("Actual hours", actual),
                card("Budget", budget));

        List<NamedCount> hoursSeries = List.of(
                new NamedCount("Estimated", estimated.longValue()),
                new NamedCount("Actual", actual.longValue()));

        return new DashboardResponse(cards, countBy(projects, Project::getStatus), hoursSeries, "Projects");
    }

    @Transactional(readOnly = true)
    public DashboardResponse employee(UUID organizationId) {
        CurrentUser user = tenantAccess.requirePermission("DASHBOARD_EMPLOYEE");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);

        UUID resourceId = user.resourceId();
        List<ProjectTask> tasks = resourceId == null
                ? List.of()
                : projectTaskRepository.findByAssignedResource(orgId, resourceId);
        long openTasks = tasks.stream()
                .filter(t -> !"COMPLETED".equals(t.getStatus()) && !"CANCELLED".equals(t.getStatus()))
                .count();

        List<Timesheet> timesheets = resourceId == null
                ? List.of()
                : timesheetRepository
                        .search(orgId, null, resourceId, null, false, null, null, Pageable.unpaged())
                        .getContent();
        Map<UUID, BigDecimal> hoursBySheet = hoursByTimesheet(timesheets);
        BigDecimal submittedHours = timesheets.stream()
                .filter(t -> "SUBMITTED".equals(t.getStatus()))
                .map(t -> hoursBySheet.getOrDefault(t.getId(), BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal approvedHours = timesheets.stream()
                .filter(t -> "APPROVED".equals(t.getStatus()))
                .map(t -> hoursBySheet.getOrDefault(t.getId(), BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal utilizationPct = BigDecimal.ZERO;
        long activeAllocations = 0;
        if (resourceId != null) {
            Resource resource = resourceRepository.findActiveById(resourceId).orElse(null);
            if (resource != null && Objects.equals(resource.getOrganizationId(), orgId)) {
                LocalDate today = LocalDate.now();
                List<ResourceAllocation> active =
                        allocationRepository.findActiveOverlappingNow(resourceId, today);
                activeAllocations = active.size();
                BigDecimal allocatedPct = active.stream()
                        .map(a -> nullToZero(a.getAllocationPercentage()))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                utilizationPct = allocatedPct.setScale(1, RoundingMode.HALF_UP);
            }
        }

        List<NamedValue> cards = List.of(
                card("Open tasks", BigDecimal.valueOf(openTasks)),
                card("Active allocations", BigDecimal.valueOf(activeAllocations)),
                card("Utilization %", utilizationPct),
                card("Submitted hours", submittedHours),
                card("Approved hours", approvedHours));

        List<NamedCount> timesheetSeries = countBy(timesheets, Timesheet::getStatus);
        List<NamedCount> taskSeries = countBy(tasks, ProjectTask::getStatus);

        return new DashboardResponse(cards, timesheetSeries, taskSeries, "Employee");
    }

    private DashboardResponse buildCrmProjectTimeDashboard(String title, Scope scope) {
        List<Lead> leads = loadLeads(scope);
        List<Deal> deals = loadDeals(scope);
        long accounts = accountRepository
                .search(scope.orgId(), null, scope.regionIds(), scope.ownerIds(), null, null, null, null, Pageable.unpaged())
                .getTotalElements();
        List<Project> projects = loadProjects(scope);
        // Timesheets still use single-user/manager filter (OWN/TEAM as current user).
        UUID timesheetOwner = tenantAccess.ownerFilterOrNull();
        List<Timesheet> timesheets =
                timesheetRepository.findAllForExport(scope.orgId(), scope.regionIds(), timesheetOwner);
        Map<UUID, BigDecimal> hoursBySheet = hoursByTimesheet(timesheets);

        BigDecimal won = deals.stream()
                .filter(d -> "WON".equals(d.getStage()))
                .map(d -> nullToZero(d.getValue()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal forecast = deals.stream()
                .filter(d -> OPEN_STAGES.contains(d.getStage()))
                .map(this::forecastValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long activeProjects = projects.stream().filter(p -> "ACTIVE".equals(p.getStatus())).count();
        BigDecimal approvedHours = timesheets.stream()
                .filter(t -> "APPROVED".equals(t.getStatus()))
                .map(t -> hoursBySheet.getOrDefault(t.getId(), BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendingHours = timesheets.stream()
                .filter(t -> "SUBMITTED".equals(t.getStatus()))
                .map(t -> hoursBySheet.getOrDefault(t.getId(), BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<NamedValue> cards = List.of(
                card("Leads", BigDecimal.valueOf(leads.size())),
                card("Accounts", BigDecimal.valueOf(accounts)),
                card("Won revenue", won),
                card("Pipeline forecast", forecast),
                card("Active projects", BigDecimal.valueOf(activeProjects)),
                card("Approved hours", approvedHours),
                card("Pending hours", pendingHours));

        return new DashboardResponse(
                cards, countBy(deals, Deal::getStage), countBy(projects, Project::getStatus), title);
    }

    private Scope scope(UUID orgId, UUID regionId, boolean applyOwnerFilter) {
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        if (regionId != null) {
            tenantAccess.assertRegionVisible(regionId);
            if (regionIds != null && !regionIds.contains(regionId)) {
                throw new BusinessException("REGION_FORBIDDEN", "Region is outside your scope");
            }
            regionIds = Set.of(regionId);
        }
        Collection<UUID> ownerIds = applyOwnerFilter ? tenantAccess.ownerIdsFilterOrNull() : projectOwnerFilter();
        return new Scope(orgId, regionIds, ownerIds);
    }

    /** Project lists use managerId for OWN/TEAM rather than generic owner. */
    private Collection<UUID> projectOwnerFilter() {
        return tenantAccess.ownerIdsFilterOrNull();
    }

    private List<Lead> loadLeads(Scope scope) {
        return leadRepository.findAllForExport(scope.orgId(), scope.regionIds(), scope.ownerIds());
    }

    private List<Deal> loadDeals(Scope scope) {
        return dealRepository.findForPipeline(scope.orgId(), scope.regionIds(), scope.ownerIds());
    }

    private List<Project> loadProjects(Scope scope) {
        return projectRepository
                .search(scope.orgId(), null, scope.regionIds(), scope.ownerIds(), null, null, null, null, null, false, Pageable.unpaged())
                .getContent();
    }

    private Map<UUID, BigDecimal> hoursByTimesheet(List<Timesheet> timesheets) {
        if (timesheets.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = timesheets.stream().map(Timesheet::getId).toList();
        Map<UUID, BigDecimal> totals = new LinkedHashMap<>();
        for (TimeEntry entry : timeEntryRepository.findActiveByTimesheetIdIn(ids)) {
            totals.merge(entry.getTimesheetId(), entry.getHours(), BigDecimal::add);
        }
        return totals;
    }

    private BigDecimal forecastValue(Deal deal) {
        BigDecimal value = nullToZero(deal.getValue());
        BigDecimal probability = deal.getProbability() != null
                ? deal.getProbability()
                : Deal.DEFAULT_PROBABILITY.getOrDefault(deal.getStage(), BigDecimal.ZERO);
        return value.multiply(probability).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private static NamedValue card(String name, BigDecimal value) {
        return new NamedValue(name, value != null ? value : BigDecimal.ZERO);
    }

    private static <T> List<NamedCount> countBy(List<T> items, java.util.function.Function<T, String> keyFn) {
        Map<String, Long> counts = items.stream()
                .collect(Collectors.groupingBy(
                        item -> {
                            String key = keyFn.apply(item);
                            return key == null || key.isBlank() ? "UNKNOWN" : key;
                        },
                        LinkedHashMap::new,
                        Collectors.counting()));
        List<NamedCount> series = new ArrayList<>();
        counts.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> series.add(new NamedCount(e.getKey(), e.getValue())));
        series.sort(Comparator.comparing(NamedCount::name));
        return series;
    }

    private static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private record Scope(UUID orgId, Collection<UUID> regionIds, Collection<UUID> ownerIds) {}
}
