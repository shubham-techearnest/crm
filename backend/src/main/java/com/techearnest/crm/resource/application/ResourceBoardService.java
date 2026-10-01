package com.techearnest.crm.resource.application;

import com.techearnest.crm.audit.application.AuditFieldChanges;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.department.domain.Department;
import com.techearnest.crm.department.domain.DepartmentRepository;
import com.techearnest.crm.metadata.application.FieldAclEvaluator;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.project.domain.ProjectTask;
import com.techearnest.crm.project.domain.ProjectTaskRepository;
import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.region.domain.RegionRepository;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardAllocation;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardFilter;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardProject;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardResource;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardSettingsResponse;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardSkill;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardSummary;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.CapacityResponse;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.GroupMetrics;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.ResourceBoardResponse;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.ResourceWorkloadResponse;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.SkillSupply;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.UpdateBoardSettingsRequest;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.WorkloadProjectCost;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.WorkloadTask;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.WorkloadTimesheet;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UnavailabilityResponse;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocation;
import com.techearnest.crm.resource.domain.ResourceAllocationRepository;
import com.techearnest.crm.resource.domain.ResourceBoardSettings;
import com.techearnest.crm.resource.domain.ResourceBoardSettingsRepository;
import com.techearnest.crm.resource.domain.ResourceMetrics;
import com.techearnest.crm.resource.domain.ResourceMetrics.Classification;
import com.techearnest.crm.resource.domain.ResourceMetrics.Thresholds;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.resource.domain.ResourceSkill;
import com.techearnest.crm.resource.domain.ResourceSkillRepository;
import com.techearnest.crm.resource.domain.ResourceType;
import com.techearnest.crm.resource.domain.ResourceUnavailability;
import com.techearnest.crm.resource.domain.ResourceUnavailabilityRepository;
import com.techearnest.crm.resource.domain.Skill;
import com.techearnest.crm.resource.domain.SkillRepository;
import com.techearnest.crm.timesheet.domain.TimeEntry;
import com.techearnest.crm.timesheet.domain.TimeEntryFact;
import com.techearnest.crm.timesheet.domain.TimeEntryRepository;
import com.techearnest.crm.timesheet.domain.Timesheet;
import com.techearnest.crm.timesheet.domain.TimesheetRepository;
import com.techearnest.crm.user.domain.User;
import com.techearnest.crm.user.domain.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Organization-wide resource board: who is where, who is free, who is overloaded, and what it costs and earns.
 * Every figure is derived from allocations, leave and approved time via {@link ResourceMetrics}; nothing is
 * maintained by hand. Visibility follows the caller's data scope and money follows rate field permissions.
 */
@Service
public class ResourceBoardService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final LocalDate FAR_FUTURE = LocalDate.of(9999, 12, 31);
    private static final LocalDate FAR_PAST = LocalDate.of(1900, 1, 1);
    private static final Set<String> CLOSED_PROJECT_STATUSES = Set.of("COMPLETED", "CANCELLED");
    private static final Set<String> DONE_TASK_STATUSES = Set.of("DONE", "COMPLETED", "CANCELLED");

    private final ResourceRepository resourceRepository;
    private final ResourceAllocationRepository allocationRepository;
    private final ResourceUnavailabilityRepository unavailabilityRepository;
    private final ResourceSkillRepository resourceSkillRepository;
    private final SkillRepository skillRepository;
    private final ProjectRepository projectRepository;
    private final ProjectTaskRepository taskRepository;
    private final TimesheetRepository timesheetRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final ResourceBoardSettingsRepository settingsRepository;
    private final ResourceTypeCatalog typeCatalog;
    private final ResourceDisplayNames displayNames;
    private final ResourceCostService costService;
    private final FieldAclEvaluator fieldAclEvaluator;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final RegionRepository regionRepository;

    public ResourceBoardService(
            ResourceRepository resourceRepository,
            ResourceAllocationRepository allocationRepository,
            ResourceUnavailabilityRepository unavailabilityRepository,
            ResourceSkillRepository resourceSkillRepository,
            SkillRepository skillRepository,
            ProjectRepository projectRepository,
            ProjectTaskRepository taskRepository,
            TimesheetRepository timesheetRepository,
            TimeEntryRepository timeEntryRepository,
            DepartmentRepository departmentRepository,
            UserRepository userRepository,
            ResourceBoardSettingsRepository settingsRepository,
            ResourceTypeCatalog typeCatalog,
            ResourceDisplayNames displayNames,
            ResourceCostService costService,
            FieldAclEvaluator fieldAclEvaluator,
            TenantAccess tenantAccess,
            AuditService auditService,
            RegionRepository regionRepository) {
        this.resourceRepository = resourceRepository;
        this.allocationRepository = allocationRepository;
        this.unavailabilityRepository = unavailabilityRepository;
        this.resourceSkillRepository = resourceSkillRepository;
        this.skillRepository = skillRepository;
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.timesheetRepository = timesheetRepository;
        this.timeEntryRepository = timeEntryRepository;
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
        this.settingsRepository = settingsRepository;
        this.typeCatalog = typeCatalog;
        this.displayNames = displayNames;
        this.costService = costService;
        this.fieldAclEvaluator = fieldAclEvaluator;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.regionRepository = regionRepository;
    }

    // ================================================================ public API

    @Transactional(readOnly = true)
    public ResourceBoardResponse board(UUID organizationId, LocalDate periodStart, LocalDate periodEnd, BoardFilter filter) {
        Context ctx = load(organizationId, periodStart, periodEnd);
        BoardFilter f = filter == null ? BoardFilter.none() : filter;
        List<Row> rows = applyFilter(ctx, f);
        List<Row> activeRows = ctx.rows.stream().filter(r -> r.active).toList();
        return new ResourceBoardResponse(
                ctx.today,
                ctx.periodStart,
                ctx.periodEnd,
                ctx.money.all(),
                settingsResponse(ctx.settings),
                ctx.weeks,
                summary(ctx, rows),
                rows.stream().map(r -> r.view).toList(),
                projects(ctx, activeRows),
                skillSupply(ctx, activeRows),
                groups(ctx, rows, r -> r.departmentKey(), r -> r.view.departmentName() == null
                        ? "No department" : r.view.departmentName()),
                groups(ctx, rows, r -> r.resource.getResourceType(), r -> typeName(r.resource.getResourceType())));
    }

    @Transactional(readOnly = true)
    public List<BoardResource> search(UUID organizationId, BoardFilter filter) {
        Context ctx = load(organizationId, null, null);
        return applyFilter(ctx, filter == null ? BoardFilter.none() : filter).stream().map(r -> r.view).toList();
    }

    @Transactional(readOnly = true)
    public List<BoardResource> byStatus(UUID organizationId, String status) {
        Context ctx = load(organizationId, null, null);
        return ctx.rows.stream()
                .filter(r -> r.active)
                .filter(r -> switch (status) {
                    case ResourceMetrics.STATUS_BENCH -> ResourceMetrics.BAND_BENCH.equals(r.classification.band())
                            && r.classification.available();
                    case ResourceMetrics.STATUS_ENDING_SOON -> r.classification.endingSoon()
                            || r.classification.engagementEndingSoon();
                    case ResourceMetrics.STATUS_OVER -> ResourceMetrics.BAND_OVER.equals(r.classification.band());
                    default -> status.equals(r.classification.status());
                })
                .map(r -> r.view)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BoardResource> available(UUID organizationId, int withinDays, BigDecimal minCapacityPct) {
        Context ctx = load(organizationId, null, null);
        LocalDate horizon = ctx.today.plusDays(Math.max(0, withinDays));
        BigDecimal minPct = minCapacityPct == null ? BigDecimal.ZERO : minCapacityPct;
        return ctx.rows.stream()
                .filter(r -> r.active)
                .filter(r -> r.classification.availableFrom() != null
                        && !r.classification.availableFrom().isAfter(horizon)
                        && r.classification.availableFromCapacityPct() != null
                        && r.classification.availableFromCapacityPct().compareTo(minPct) >= 0)
                .sorted(Comparator.comparing(r -> r.classification.availableFrom()))
                .map(r -> r.view)
                .toList();
    }

    @Transactional(readOnly = true)
    public CapacityResponse capacity(UUID organizationId, LocalDate periodStart, LocalDate periodEnd) {
        Context ctx = load(organizationId, periodStart, periodEnd);
        List<Row> active = ctx.rows.stream().filter(r -> r.active).toList();
        return new CapacityResponse(
                ctx.periodStart,
                ctx.periodEnd,
                ctx.money.all(),
                group(ctx, "ORGANIZATION", "Organization", active),
                groups(ctx, active, Row::departmentKey, r -> r.view.departmentName() == null
                        ? "No department" : r.view.departmentName()),
                groups(ctx, active, r -> r.resource.getResourceType(), r -> typeName(r.resource.getResourceType())),
                projects(ctx, active));
    }

    @Transactional(readOnly = true)
    public ResourceWorkloadResponse workload(UUID resourceId, LocalDate periodStart, LocalDate periodEnd) {
        Context ctx = load(null, periodStart, periodEnd);
        Row row = ctx.rows.stream()
                .filter(r -> r.resource.getId().equals(resourceId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        Resource resource = row.resource;

        List<ResourceAllocation> history = allocationRepository.findAllByResource(resourceId);
        Map<UUID, Project> projects = projectsById(history.stream().map(ResourceAllocation::getProjectId).toList());
        List<BoardAllocation> allocations = history.stream()
                .map(a -> allocationView(ctx, resource, a, projects.get(a.getProjectId())))
                .toList();

        List<ProjectTask> assigned = taskRepository.findByAssignedResource(resource.getOrganizationId(), resourceId);
        Map<UUID, Project> taskProjects = projectsById(assigned.stream().map(ProjectTask::getProjectId).toList());
        List<WorkloadTask> tasks = assigned.stream()
                .filter(t -> t.getStatus() == null || !DONE_TASK_STATUSES.contains(t.getStatus().toUpperCase(Locale.ROOT)))
                .map(t -> new WorkloadTask(
                        t.getId(), t.getProjectId(),
                        taskProjects.containsKey(t.getProjectId()) ? taskProjects.get(t.getProjectId()).getName() : null,
                        t.getName(), t.getStatus(), t.getPriority(), t.getDueDate(),
                        t.getEstimatedHours(), t.getActualHours()))
                .toList();

        List<WorkloadTimesheet> timesheets = new ArrayList<>();
        for (Timesheet timesheet : timesheetRepository.findRecentByResourceId(resourceId, PageRequest.of(0, 12))) {
            BigDecimal hours = BigDecimal.ZERO;
            BigDecimal billable = BigDecimal.ZERO;
            for (TimeEntry entry : timeEntryRepository.findActiveByTimesheetId(timesheet.getId())) {
                BigDecimal h = entry.getHours() == null ? BigDecimal.ZERO : entry.getHours();
                hours = hours.add(h);
                if (entry.isBillable()) {
                    billable = billable.add(h);
                }
            }
            timesheets.add(new WorkloadTimesheet(
                    timesheet.getId(), timesheet.getWeekStartDate(), timesheet.getStatus(), hours, billable));
        }

        List<TimeEntryFact> facts = timeEntryRepository.findFacts(
                resource.getOrganizationId(), FAR_PAST, FAR_FUTURE, resourceId, null);
        Map<UUID, ResourceCostService.Totals> byProject =
                costService.totalsBy(facts, TimeEntryFact::projectId, Map.of(resourceId, resource));
        Map<UUID, Project> costProjects = projectsById(byProject.keySet());
        List<WorkloadProjectCost> costs = byProject.entrySet().stream()
                .map(e -> {
                    ResourceCostService.Totals t = e.getValue();
                    Project p = costProjects.get(e.getKey());
                    return new WorkloadProjectCost(
                            e.getKey(), p == null ? null : p.getName(), t.hours(), t.billableHours(),
                            ctx.money.cost(t.cost()), ctx.money.revenue(t.revenue()),
                            ctx.money.margin(t.margin()), ctx.money.margin(t.marginPct()));
                })
                .sorted(Comparator.comparing(WorkloadProjectCost::hours).reversed())
                .toList();

        List<UnavailabilityResponse> leave = unavailabilityRepository.findActiveByResource(resourceId).stream()
                .map(UnavailabilityResponse::from)
                .toList();
        return new ResourceWorkloadResponse(
                ctx.money.all(), row.view, allocations, tasks, timesheets, costs, leave, ctx.weeks);
    }

    @Transactional(readOnly = true)
    public BoardSettingsResponse settings(UUID organizationId) {
        tenantAccess.requirePermission("RESOURCE_BOARD_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        return settingsResponse(settingsFor(orgId));
    }

    @Transactional
    public BoardSettingsResponse updateSettings(UUID organizationId, UpdateBoardSettingsRequest request) {
        CurrentUser user = tenantAccess.requirePermission("RESOURCE_BOARD_CONFIGURE");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        ResourceBoardSettings settings = settingsRepository.findById(orgId)
                .orElseGet(() -> ResourceBoardSettings.defaults(orgId));
        BoardSettingsResponse before = settingsResponse(settings);
        settings.update(
                request.endingSoonDays(),
                request.benchMaxAllocationPct(),
                request.fullAllocationPct(),
                request.overallocationPct(),
                request.forecastWeeks());
        if (settings.getBenchMaxAllocationPct().compareTo(settings.getFullAllocationPct()) >= 0) {
            throw new BusinessException("INVALID_THRESHOLDS", "Bench limit must be below the fully-allocated level");
        }
        if (settings.getOverallocationPct().compareTo(settings.getFullAllocationPct()) < 0) {
            throw new BusinessException(
                    "INVALID_THRESHOLDS", "Over-allocation level cannot be below the fully-allocated level");
        }
        settingsRepository.save(settings);
        String summary = AuditFieldChanges.builder()
                .addIfChanged("endingSoonDays", "Ending soon (days)", before.endingSoonDays(), settings.getEndingSoonDays())
                .addIfChanged("benchMaxAllocationPct", "Bench limit %", before.benchMaxAllocationPct(),
                        settings.getBenchMaxAllocationPct())
                .addIfChanged("fullAllocationPct", "Fully allocated %", before.fullAllocationPct(),
                        settings.getFullAllocationPct())
                .addIfChanged("overallocationPct", "Over-allocated above %", before.overallocationPct(),
                        settings.getOverallocationPct())
                .addIfChanged("forecastWeeks", "Forecast weeks", before.forecastWeeks(), settings.getForecastWeeks())
                .toJson();
        if (summary != null) {
            auditService.recordWithSummary(orgId, user.userId(), "UPDATE", "RESOURCE_BOARD_SETTINGS", orgId, summary);
        }
        return settingsResponse(settings);
    }

    // ================================================================ loading

    /** Which money the caller may see. Cost needs cost-rate access, revenue billing-rate access, margin both. */
    private record Money(boolean cost, boolean revenue) {

        boolean all() {
            return cost && revenue;
        }

        BigDecimal cost(BigDecimal value) {
            return cost ? value : null;
        }

        BigDecimal revenue(BigDecimal value) {
            return revenue ? value : null;
        }

        BigDecimal margin(BigDecimal value) {
            return all() ? value : null;
        }
    }

    private static final class Context {
        UUID orgId;
        LocalDate today;
        LocalDate periodStart;
        LocalDate periodEnd;
        ResourceBoardSettings settings;
        Thresholds thresholds;
        Money money;
        List<LocalDate> weeks;
        List<Row> rows = new ArrayList<>();
        Map<UUID, Resource> resources = new HashMap<>();
        Map<UUID, List<ResourceAllocation>> allocations = new HashMap<>();
        Map<UUID, Project> projects = new HashMap<>();
        Map<UUID, Skill> skills = new HashMap<>();
        Map<UUID, List<ResourceSkill>> resourceSkills = new HashMap<>();
        Map<UUID, String> userNames = new HashMap<>();
    }

    /** One resource with its raw numbers (always computed) and its caller-facing view (money masked). */
    private static final class Row {
        Resource resource;
        Classification classification;
        boolean active;
        BigDecimal capacity;
        BigDecimal allocated;
        ResourceCostService.Totals actuals;
        BigDecimal pendingHours;
        BoardResource view;

        String departmentKey() {
            return resource.getDepartmentId() == null ? "NONE" : resource.getDepartmentId().toString();
        }
    }

    private Context load(UUID organizationId, LocalDate periodStart, LocalDate periodEnd) {
        tenantAccess.requirePermission("RESOURCE_BOARD_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Context ctx = new Context();
        ctx.orgId = orgId;
        ctx.today = LocalDate.now();
        ctx.periodStart = periodStart != null ? periodStart : ctx.today.withDayOfMonth(1);
        ctx.periodEnd = periodEnd != null ? periodEnd : ctx.today.with(TemporalAdjusters.lastDayOfMonth());
        if (ctx.periodEnd.isBefore(ctx.periodStart)) {
            throw new BusinessException("INVALID_PERIOD", "Period end must be on or after its start");
        }
        if (ChronoUnit.DAYS.between(ctx.periodStart, ctx.periodEnd) > 366) {
            throw new BusinessException("INVALID_PERIOD", "The period can be at most one year");
        }
        ctx.settings = settingsFor(orgId);
        ctx.thresholds = Thresholds.of(ctx.settings);
        ctx.money = new Money(
                fieldAclEvaluator.canView("resource", "costRate"),
                fieldAclEvaluator.canView("resource", "billingRate"));
        LocalDate monday = ctx.today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        ctx.weeks = new ArrayList<>();
        for (int i = 0; i < ctx.settings.getForecastWeeks(); i++) {
            ctx.weeks.add(monday.plusWeeks(i));
        }

        List<Resource> resources = resourceRepository.findForBoard(
                orgId, tenantAccess.regionFilterOrNull(), tenantAccess.ownerFilterOrNull());
        if (resources.isEmpty()) {
            return ctx;
        }
        resources.forEach(r -> ctx.resources.put(r.getId(), r));
        Set<UUID> ids = ctx.resources.keySet();

        LocalDate windowStart = ctx.periodStart.isBefore(ctx.today) ? ctx.periodStart : ctx.today;
        for (ResourceAllocation a : allocationRepository.findForResourcesInWindow(ids, windowStart, FAR_FUTURE)) {
            ctx.allocations.computeIfAbsent(a.getResourceId(), k -> new ArrayList<>()).add(a);
        }
        ctx.projects.putAll(projectsById(ctx.allocations.values().stream()
                .flatMap(List::stream)
                .map(ResourceAllocation::getProjectId)
                .collect(Collectors.toSet())));

        LocalDate leaveEnd = ctx.weeks.isEmpty() ? ctx.periodEnd : max(ctx.periodEnd, ctx.weeks.getLast().plusDays(6));
        Map<UUID, List<ResourceUnavailability>> leave = new HashMap<>();
        for (ResourceUnavailability off : unavailabilityRepository.findOverlapping(ids, windowStart, leaveEnd)) {
            leave.computeIfAbsent(off.getResourceId(), k -> new ArrayList<>()).add(off);
        }

        for (ResourceSkill rs : resourceSkillRepository.findByResourceIds(ids)) {
            ctx.resourceSkills.computeIfAbsent(rs.getResourceId(), k -> new ArrayList<>()).add(rs);
        }
        Set<UUID> skillIds = ctx.resourceSkills.values().stream()
                .flatMap(List::stream)
                .map(ResourceSkill::getSkillId)
                .collect(Collectors.toSet());
        if (!skillIds.isEmpty()) {
            skillRepository.findAllById(skillIds).forEach(s -> ctx.skills.put(s.getId(), s));
        }

        Map<UUID, String> departments = new HashMap<>();
        Set<UUID> departmentIds = resources.stream()
                .map(Resource::getDepartmentId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        if (!departmentIds.isEmpty()) {
            for (Department d : departmentRepository.findAllById(departmentIds)) {
                departments.put(d.getId(), d.getName());
            }
        }
        Set<UUID> userIds = new HashSet<>();
        resources.forEach(r -> {
            if (r.getManagerId() != null) userIds.add(r.getManagerId());
        });
        ctx.projects.values().forEach(p -> {
            if (p.getProjectManagerId() != null) userIds.add(p.getProjectManagerId());
        });
        if (!userIds.isEmpty()) {
            for (User u : userRepository.findAllById(userIds)) {
                ctx.userNames.put(u.getId(), u.getDisplayName());
            }
        }
        Map<UUID, String> names = displayNames.namesFor(resources);

        Map<UUID, List<TimeEntryFact>> facts = new HashMap<>();
        for (TimeEntryFact fact : timeEntryRepository.findFacts(orgId, ctx.periodStart, ctx.periodEnd, null, null)) {
            if (ids.contains(fact.resourceId())) {
                facts.computeIfAbsent(fact.resourceId(), k -> new ArrayList<>()).add(fact);
            }
        }

        for (Resource resource : resources) {
            List<ResourceAllocation> allocations = ctx.allocations.getOrDefault(resource.getId(), List.of());
            List<ResourceUnavailability> off = leave.getOrDefault(resource.getId(), List.of());
            List<TimeEntryFact> resourceFacts = facts.getOrDefault(resource.getId(), List.of());
            Row row = new Row();
            row.resource = resource;
            row.classification = ResourceMetrics.classify(resource, allocations, off, ctx.today, ctx.thresholds);
            row.active = !Resource.ENDED_STATUSES.contains(row.classification.status())
                    && !ResourceMetrics.STATUS_CONTRACT_EXPIRED.equals(row.classification.status());
            row.capacity = ResourceMetrics.capacityHours(resource, ctx.periodStart, ctx.periodEnd, off);
            row.allocated = allocations.stream()
                    .filter(a -> !ResourceAllocation.STATUS_CANCELLED.equals(a.getStatus()))
                    .map(a -> ResourceMetrics.allocatedHoursInPeriod(
                            a, resource.getCapacityHoursPerWeek(), ctx.periodStart, ctx.periodEnd))
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);
            row.actuals = costService
                    .totalsBy(resourceFacts, f -> Boolean.TRUE, Map.of(resource.getId(), resource))
                    .getOrDefault(Boolean.TRUE, ResourceCostService.Totals.ZERO);
            row.pendingHours = resourceFacts.stream()
                    .filter(f -> Timesheet.STATUS_SUBMITTED.equals(f.timesheetStatus()))
                    .map(f -> f.hours() == null ? BigDecimal.ZERO : f.hours())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            row.view = view(ctx, row, allocations, names.get(resource.getId()),
                    departments.get(resource.getDepartmentId()));
            ctx.rows.add(row);
        }
        ctx.rows.sort(Comparator
                .comparing((Row r) -> !r.active)
                .thenComparing(r -> r.view.name() == null ? "" : r.view.name().toLowerCase(Locale.ROOT)));
        return ctx;
    }

    private BoardResource view(
            Context ctx, Row row, List<ResourceAllocation> allocations, String name, String departmentName) {
        Resource r = row.resource;
        Classification c = row.classification;
        Money m = ctx.money;
        List<BoardSkill> skills = ctx.resourceSkills.getOrDefault(r.getId(), List.of()).stream()
                .map(rs -> {
                    Skill skill = ctx.skills.get(rs.getSkillId());
                    return new BoardSkill(rs.getSkillId(), skill == null ? null : skill.getName(),
                            rs.getProficiency(), rs.getYearsOfExperience(), rs.isPrimary());
                })
                .sorted(Comparator.comparing(BoardSkill::primary).reversed()
                        .thenComparing(s -> s.name() == null ? "" : s.name()))
                .toList();
        List<BoardAllocation> current = allocations.stream()
                .filter(ResourceAllocation::isOpen)
                .filter(a -> !a.getEndDate().isBefore(ctx.today))
                .sorted(Comparator.comparing(ResourceAllocation::getStartDate))
                .map(a -> allocationView(ctx, r, a, ctx.projects.get(a.getProjectId())))
                .toList();
        List<BigDecimal> weekly = ctx.weeks.isEmpty()
                ? List.of()
                : ResourceMetrics.weeklyLoad(allocations, r.getCapacityHoursPerWeek(), ctx.weeks.getFirst(), ctx.weeks.size());
        BigDecimal available = row.capacity.subtract(row.allocated).max(BigDecimal.ZERO);
        ResourceCostService.Totals t = row.actuals;
        return new BoardResource(
                r.getId(),
                name,
                r.getEmployeeCode(),
                r.getResourceType(),
                r.isExternal() ? "EXTERNAL" : "INTERNAL",
                r.getDesignation(),
                r.getDepartmentId(),
                departmentName,
                r.getManagerId() == null ? null : ctx.userNames.get(r.getManagerId()),
                r.getRegionId(),
                r.getLocation(),
                c.status(),
                r.getStatus(),
                c.band(),
                c.currentAllocationPct(),
                c.futureAllocationPct(),
                c.available(),
                c.availableFrom(),
                c.availableFromCapacityPct(),
                c.endingSoon(),
                c.currentAllocationEndsOn(),
                c.nextAllocationStartsOn(),
                r.getEngagementStartDate(),
                r.getEngagementEndDate(),
                c.engagementEndingSoon(),
                c.onLeave(),
                r.getExperienceYears(),
                r.isBillable(),
                c.activeProjectCount(),
                row.capacity,
                row.allocated,
                available.setScale(2, RoundingMode.HALF_UP),
                ResourceMetrics.percent(row.allocated, row.capacity),
                t.hours(),
                t.billableHours(),
                row.pendingHours,
                m.cost(t.cost()),
                m.revenue(t.revenue()),
                m.margin(t.margin()),
                m.margin(t.marginPct()),
                m.cost(r.getCostRate()),
                m.revenue(r.getBillingRate()),
                m.cost || m.revenue ? r.getRateUnit() : null,
                skills,
                current,
                weekly);
    }

    private BoardAllocation allocationView(Context ctx, Resource resource, ResourceAllocation a, Project project) {
        String phase;
        if (ResourceAllocation.STATUS_CANCELLED.equals(a.getStatus())) {
            phase = "CANCELLED";
        } else if (!a.isOpen() || a.getEndDate().isBefore(ctx.today)) {
            phase = "PAST";
        } else if (a.getStartDate().isAfter(ctx.today)) {
            phase = "FUTURE";
        } else {
            phase = "CURRENT";
        }
        return new BoardAllocation(
                a.getId(),
                a.getProjectId(),
                project == null ? null : project.getName(),
                project == null ? null : project.getProjectCode(),
                project == null ? null : project.getStatus(),
                project == null ? null : project.getEndDate(),
                a.getRole(),
                ResourceMetrics.effectivePercentage(a, resource.getCapacityHoursPerWeek()),
                ResourceMetrics.hoursPerWeek(a, resource.getCapacityHoursPerWeek()),
                a.getStartDate(),
                a.getEndDate(),
                a.getStatus(),
                phase,
                a.isBillable(),
                ctx.money.cost(ResourceMetrics.costRateFor(a, resource)),
                ctx.money.revenue(ResourceMetrics.billingRateFor(a, resource)));
    }

    // ================================================================ filtering and aggregation

    /** A parent region (e.g. a zone) covers the resources of all regions beneath it. */
    private Set<UUID> regionWithDescendants(UUID orgId, UUID regionId) {
        Map<UUID, List<UUID>> children = new HashMap<>();
        for (Region region : regionRepository.findAllActiveByOrganization(orgId)) {
            if (region.getParentId() != null) {
                children.computeIfAbsent(region.getParentId(), k -> new ArrayList<>()).add(region.getId());
            }
        }
        Set<UUID> out = new HashSet<>();
        List<UUID> queue = new ArrayList<>(List.of(regionId));
        while (!queue.isEmpty()) {
            UUID next = queue.remove(queue.size() - 1);
            if (out.add(next)) {
                queue.addAll(children.getOrDefault(next, List.of()));
            }
        }
        return out;
    }

    private List<Row> applyFilter(Context ctx, BoardFilter f) {
        String search = f.search() == null || f.search().isBlank() ? null : f.search().trim().toLowerCase(Locale.ROOT);
        Set<String> types = upper(f.resourceTypes());
        Set<String> statuses = upper(f.statuses());
        String location = f.location() == null || f.location().isBlank() ? null : f.location().trim().toLowerCase(Locale.ROOT);
        LocalDate availableBy = f.availableWithinDays() == null ? null : ctx.today.plusDays(f.availableWithinDays());
        List<UUID> skillIds = f.skillIds() == null ? List.of() : f.skillIds();
        boolean wantsInactive = f.includeInactive() || statuses.stream().anyMatch(Resource.ENDED_STATUSES::contains)
                || statuses.contains(ResourceMetrics.STATUS_CONTRACT_EXPIRED);
        Set<UUID> regionIds = f.regionId() == null ? null : regionWithDescendants(ctx.orgId, f.regionId());

        List<Row> out = new ArrayList<>();
        for (Row row : ctx.rows) {
            Resource r = row.resource;
            BoardResource v = row.view;
            if (!row.active && !wantsInactive) continue;
            if (!types.isEmpty() && !types.contains(r.getResourceType())) continue;
            if (f.category() != null && !f.category().equalsIgnoreCase(v.category())) continue;
            if (f.departmentId() != null && !f.departmentId().equals(r.getDepartmentId())) continue;
            if (regionIds != null && !regionIds.contains(r.getRegionId())) continue;
            if (f.billable() != null && f.billable() != r.isBillable()) continue;
            if (!statuses.isEmpty() && !statuses.contains(v.status())
                    && !(statuses.contains(ResourceMetrics.STATUS_ENDING_SOON) && v.endingSoon())
                    && !(statuses.contains(ResourceMetrics.STATUS_OVER) && ResourceMetrics.BAND_OVER.equals(v.band()))) {
                continue;
            }
            if (location != null && (r.getLocation() == null || !r.getLocation().toLowerCase(Locale.ROOT).contains(location))) {
                continue;
            }
            if (f.projectId() != null && ctx.allocations.getOrDefault(r.getId(), List.of()).stream()
                    .noneMatch(a -> a.isOpen() && a.getProjectId().equals(f.projectId()))) {
                continue;
            }
            if (f.maxAllocationPct() != null && v.currentAllocationPct().compareTo(f.maxAllocationPct()) > 0) continue;
            if (availableBy != null && (v.availableFrom() == null || v.availableFrom().isAfter(availableBy))) continue;
            if (!skillIds.isEmpty() && !hasSkills(ctx, r, skillIds, f.minExperienceYears())) continue;
            if (skillIds.isEmpty() && f.minExperienceYears() != null
                    && (r.getExperienceYears() == null || r.getExperienceYears().compareTo(f.minExperienceYears()) < 0)) {
                continue;
            }
            if (search != null && !matches(v, search)) continue;
            out.add(row);
        }
        return out;
    }

    /** Has every requested skill; with a minimum experience, each skill (or the overall profile) must meet it. */
    private static boolean hasSkills(Context ctx, Resource r, List<UUID> skillIds, BigDecimal minYears) {
        Map<UUID, ResourceSkill> own = ctx.resourceSkills.getOrDefault(r.getId(), List.of()).stream()
                .collect(Collectors.toMap(ResourceSkill::getSkillId, Function.identity(), (a, b) -> a));
        for (UUID skillId : skillIds) {
            ResourceSkill rs = own.get(skillId);
            if (rs == null) {
                return false;
            }
            if (minYears != null) {
                BigDecimal years = rs.getYearsOfExperience() != null ? rs.getYearsOfExperience() : r.getExperienceYears();
                if (years == null || years.compareTo(minYears) < 0) {
                    return false;
                }
            }
        }
        return true;
    }

    private static boolean matches(BoardResource v, String search) {
        if (contains(v.name(), search) || contains(v.code(), search) || contains(v.designation(), search)
                || contains(v.location(), search) || contains(v.departmentName(), search)) {
            return true;
        }
        return v.skills().stream().anyMatch(s -> contains(s.name(), search))
                || v.allocations().stream().anyMatch(a -> contains(a.projectName(), search));
    }

    private BoardSummary summary(Context ctx, List<Row> rows) {
        int employees = 0;
        int externals = 0;
        int available = 0;
        int bench = 0;
        int partial = 0;
        int full = 0;
        int over = 0;
        int endingSoon = 0;
        int onLeave = 0;
        Map<String, Integer> byType = new TreeMap<>();
        Map<String, Integer> byStatus = new TreeMap<>();
        List<Row> active = new ArrayList<>();
        for (Row row : rows) {
            byStatus.merge(row.classification.status(), 1, Integer::sum);
            if (!row.active) {
                continue;
            }
            active.add(row);
            Classification c = row.classification;
            byType.merge(row.resource.getResourceType(), 1, Integer::sum);
            if (row.resource.isExternal()) externals++; else employees++;
            if (c.available()) available++;
            switch (c.band()) {
                case ResourceMetrics.BAND_BENCH -> bench++;
                case ResourceMetrics.BAND_PARTIAL -> partial++;
                case ResourceMetrics.BAND_FULL -> full++;
                default -> over++;
            }
            if (c.endingSoon() || c.engagementEndingSoon()) endingSoon++;
            if (ResourceMetrics.STATUS_ON_LEAVE.equals(c.status())) onLeave++;
        }
        int inactive = (int) ctx.rows.stream().filter(r -> !r.active).count();
        return new BoardSummary(
                active.size(), employees, externals, available, bench, partial, full, over, endingSoon, onLeave,
                inactive, byType, byStatus, group(ctx, "ORGANIZATION", "Organization", active));
    }

    private List<GroupMetrics> groups(
            Context ctx, List<Row> rows, Function<Row, String> key, Function<Row, String> label) {
        Map<String, List<Row>> grouped = new LinkedHashMap<>();
        Map<String, String> labels = new HashMap<>();
        for (Row row : rows) {
            if (!row.active) continue;
            String k = key.apply(row);
            grouped.computeIfAbsent(k, x -> new ArrayList<>()).add(row);
            labels.putIfAbsent(k, label.apply(row));
        }
        return grouped.entrySet().stream()
                .map(e -> group(ctx, e.getKey(), labels.get(e.getKey()), e.getValue()))
                .sorted(Comparator.comparing(GroupMetrics::label))
                .toList();
    }

    private GroupMetrics group(Context ctx, String key, String label, List<Row> rows) {
        BigDecimal capacity = BigDecimal.ZERO;
        BigDecimal allocated = BigDecimal.ZERO;
        BigDecimal actual = BigDecimal.ZERO;
        BigDecimal billable = BigDecimal.ZERO;
        BigDecimal cost = BigDecimal.ZERO;
        BigDecimal revenue = BigDecimal.ZERO;
        for (Row row : rows) {
            capacity = capacity.add(row.capacity);
            allocated = allocated.add(row.allocated);
            actual = actual.add(row.actuals.hours());
            billable = billable.add(row.actuals.billableHours());
            cost = cost.add(row.actuals.cost());
            revenue = revenue.add(row.actuals.revenue());
        }
        Money m = ctx.money;
        return new GroupMetrics(
                key,
                label,
                rows.size(),
                capacity.setScale(2, RoundingMode.HALF_UP),
                allocated.setScale(2, RoundingMode.HALF_UP),
                capacity.subtract(allocated).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP),
                ResourceMetrics.percent(allocated, capacity),
                actual,
                billable,
                actual.subtract(billable),
                ResourceMetrics.percent(billable, capacity),
                m.cost(cost),
                m.revenue(revenue),
                m.margin(ResourceMetrics.margin(revenue, cost)),
                m.margin(ResourceMetrics.marginPct(revenue, cost)));
    }

    private List<BoardProject> projects(Context ctx, List<Row> rows) {
        Map<UUID, List<ResourceAllocation>> byProject = new HashMap<>();
        Map<UUID, Row> rowsById = new HashMap<>();
        for (Row row : rows) {
            rowsById.put(row.resource.getId(), row);
            for (ResourceAllocation a : ctx.allocations.getOrDefault(row.resource.getId(), List.of())) {
                if (a.isOpen() && !a.getEndDate().isBefore(ctx.today)) {
                    byProject.computeIfAbsent(a.getProjectId(), k -> new ArrayList<>()).add(a);
                }
            }
        }
        Set<UUID> projectIds = byProject.keySet().stream()
                .filter(id -> ctx.projects.containsKey(id)
                        && !CLOSED_PROJECT_STATUSES.contains(ctx.projects.get(id).getStatus()))
                .collect(Collectors.toSet());
        if (projectIds.isEmpty()) {
            return List.of();
        }
        List<TimeEntryFact> facts = timeEntryRepository.findApprovedFactsByProjects(projectIds).stream()
                .filter(f -> ctx.resources.containsKey(f.resourceId()))
                .toList();
        Map<UUID, ResourceCostService.Totals> totals = costService.totalsBy(facts, TimeEntryFact::projectId, ctx.resources);

        LocalDate horizon = ctx.today.plusDays(ctx.thresholds.endingSoonDays());
        List<BoardProject> out = new ArrayList<>();
        for (UUID projectId : projectIds) {
            Project p = ctx.projects.get(projectId);
            List<ResourceAllocation> team = byProject.get(projectId);
            Set<UUID> currentMembers = new HashSet<>();
            BigDecimal fte = BigDecimal.ZERO;
            BigDecimal weeklyHours = BigDecimal.ZERO;
            BigDecimal allocated = BigDecimal.ZERO;
            int endingSoon = 0;
            Set<UUID> overloaded = new HashSet<>();
            for (ResourceAllocation a : team) {
                Row row = rowsById.get(a.getResourceId());
                BigDecimal capacity = row.resource.getCapacityHoursPerWeek();
                allocated = allocated.add(ResourceMetrics.allocatedHoursInPeriod(a, capacity, ctx.periodStart, ctx.periodEnd));
                if (a.covers(ctx.today)) {
                    currentMembers.add(a.getResourceId());
                    fte = fte.add(ResourceMetrics.effectivePercentage(a, capacity));
                    weeklyHours = weeklyHours.add(ResourceMetrics.hoursPerWeek(a, capacity));
                    if (!a.getEndDate().isAfter(horizon)) endingSoon++;
                    if (ResourceMetrics.BAND_OVER.equals(row.classification.band())) overloaded.add(a.getResourceId());
                }
            }
            ResourceCostService.Totals t = totals.getOrDefault(projectId, ResourceCostService.Totals.ZERO);
            Money m = ctx.money;
            out.add(new BoardProject(
                    projectId,
                    p.getName(),
                    p.getProjectCode(),
                    p.getStatus(),
                    p.getBillingType(),
                    p.getEndDate(),
                    p.getProjectManagerId() == null ? null : ctx.userNames.get(p.getProjectManagerId()),
                    currentMembers.size(),
                    fte.divide(HUNDRED, 2, RoundingMode.HALF_UP),
                    allocated.setScale(2, RoundingMode.HALF_UP),
                    t.hours(),
                    t.billableHours(),
                    m.cost(t.cost()),
                    m.revenue(t.revenue()),
                    m.margin(t.margin()),
                    m.margin(t.marginPct()),
                    endingSoon,
                    overloaded.size(),
                    staffingSignal(ctx, p, currentMembers.size(), overloaded.size(), endingSoon, weeklyHours)));
        }
        out.sort(Comparator.comparing(BoardProject::name, Comparator.nullsLast(String::compareToIgnoreCase)));
        return out;
    }

    /**
     * UNSTAFFED: nobody on it today. OVERDUE: past its end date. UNDER_RESOURCED: remaining estimate exceeds the
     * team's hours until the end date. OVERLOADED: a member is over-allocated. ROLL_OFF_RISK: people leave before
     * the project ends. OVER_RESOURCED: team hours exceed the remaining estimate by half again. Otherwise OK.
     */
    private static String staffingSignal(
            Context ctx, Project p, int members, int overloaded, int endingSoon, BigDecimal weeklyHours) {
        if (members == 0) {
            return "UNSTAFFED";
        }
        if (p.getEndDate() != null && p.getEndDate().isBefore(ctx.today)) {
            return "OVERDUE";
        }
        BigDecimal remaining = p.getEstimatedHours() == null
                ? null
                : p.getEstimatedHours().subtract(p.getActualHours() == null ? BigDecimal.ZERO : p.getActualHours());
        BigDecimal teamHours = null;
        if (p.getEndDate() != null) {
            BigDecimal weeks = BigDecimal.valueOf(ResourceMetrics.inclusiveDays(ctx.today, p.getEndDate()))
                    .divide(BigDecimal.valueOf(7), 4, RoundingMode.HALF_UP);
            teamHours = weeklyHours.multiply(weeks);
        }
        if (remaining != null && teamHours != null && remaining.compareTo(teamHours) > 0) {
            return "UNDER_RESOURCED";
        }
        if (overloaded > 0) {
            return "OVERLOADED";
        }
        if (endingSoon > 0 && (p.getEndDate() == null
                || p.getEndDate().isAfter(ctx.today.plusDays(ctx.thresholds.endingSoonDays())))) {
            return "ROLL_OFF_RISK";
        }
        if (remaining != null && remaining.signum() > 0 && teamHours != null
                && teamHours.compareTo(remaining.multiply(new BigDecimal("1.5"))) > 0) {
            return "OVER_RESOURCED";
        }
        return "OK";
    }

    private List<SkillSupply> skillSupply(Context ctx, List<Row> rows) {
        Map<UUID, int[]> counts = new HashMap<>();
        for (Row row : rows) {
            for (ResourceSkill rs : ctx.resourceSkills.getOrDefault(row.resource.getId(), List.of())) {
                int[] c = counts.computeIfAbsent(rs.getSkillId(), k -> new int[3]);
                c[0]++;
                if (row.classification.available()) c[1]++;
                if (rs.isPrimary()) c[2]++;
            }
        }
        return counts.entrySet().stream()
                .map(e -> {
                    Skill skill = ctx.skills.get(e.getKey());
                    return new SkillSupply(
                            e.getKey(),
                            skill == null ? null : skill.getName(),
                            skill == null ? null : skill.getCategory(),
                            e.getValue()[0],
                            e.getValue()[1],
                            e.getValue()[2]);
                })
                .sorted(Comparator.comparing(SkillSupply::resources).reversed()
                        .thenComparing(s -> s.name() == null ? "" : s.name()))
                .toList();
    }

    // ================================================================ helpers

    private ResourceBoardSettings settingsFor(UUID orgId) {
        return settingsRepository.findById(orgId).orElseGet(() -> ResourceBoardSettings.defaults(orgId));
    }

    private static BoardSettingsResponse settingsResponse(ResourceBoardSettings s) {
        return new BoardSettingsResponse(
                s.getEndingSoonDays(),
                s.getBenchMaxAllocationPct(),
                s.getFullAllocationPct(),
                s.getOverallocationPct(),
                s.getForecastWeeks(),
                s.getUpdatedAt());
    }

    private Map<UUID, Project> projectsById(Collection<UUID> ids) {
        Map<UUID, Project> projects = new HashMap<>();
        if (ids.isEmpty()) {
            return projects;
        }
        for (Project p : projectRepository.findAllById(new HashSet<>(ids))) {
            if (p.getDeletedAt() == null) {
                projects.put(p.getId(), p);
            }
        }
        return projects;
    }

    private String typeName(String code) {
        return typeCatalog.find(code).map(ResourceType::getName).orElse(code);
    }

    private static Set<String> upper(List<String> values) {
        if (values == null) {
            return Set.of();
        }
        return values.stream()
                .filter(v -> v != null && !v.isBlank())
                .map(v -> v.trim().toUpperCase(Locale.ROOT))
                .collect(Collectors.toSet());
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static LocalDate max(LocalDate a, LocalDate b) {
        return a.isAfter(b) ? a : b;
    }
}
