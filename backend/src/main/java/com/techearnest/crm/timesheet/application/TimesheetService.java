package com.techearnest.crm.timesheet.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.approval.application.ApprovalService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.mail.MailGateway;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.application.FieldAclEvaluator;
import com.techearnest.crm.notification.application.NotificationService;
import com.techearnest.crm.organization.domain.OrganizationRepository;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.project.domain.ProjectTask;
import com.techearnest.crm.project.domain.ProjectTaskRepository;
import com.techearnest.crm.resource.application.ResourceDisplayNames;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocation;
import com.techearnest.crm.resource.domain.ResourceAllocationRepository;
import com.techearnest.crm.resource.domain.ResourceMetrics;
import com.techearnest.crm.resource.domain.ResourceRepository;
import static com.techearnest.crm.timesheet.api.dto.TimesheetDtos.START_BLANK;
import static com.techearnest.crm.timesheet.api.dto.TimesheetDtos.START_COPY_PREVIOUS;
import static com.techearnest.crm.timesheet.api.dto.TimesheetDtos.START_CUSTOM;
import static com.techearnest.crm.timesheet.api.dto.TimesheetDtos.START_QUICK_FILL;

import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.CreateTimeEntryRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.CreateTimesheetRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.EntryProjectOption;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.EntryTaskOption;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.LinkEntryRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.QuickFillRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.RejectTimesheetRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimeEntryResponse;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimesheetResponse;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.UpdateTimeEntryRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.UpdateTimesheetRequest;
import com.techearnest.crm.timesheet.domain.TimeEntry;
import com.techearnest.crm.timesheet.domain.TimeEntryRepository;
import com.techearnest.crm.timesheet.domain.Timesheet;
import com.techearnest.crm.timesheet.domain.TimesheetRepository;
import com.techearnest.crm.timesheet.domain.TimesheetScope;
import com.techearnest.crm.timesheet.event.TimesheetApprovedEvent;
import com.techearnest.crm.timesheet.event.TimesheetRejectedEvent;
import com.techearnest.crm.timesheet.event.TimesheetSubmittedEvent;
import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TimesheetService {

    public static final String PROXY_PERMISSION = "TIMESHEET_PROXY";

    private static final DateTimeFormatter WEEK_LABEL = DateTimeFormatter.ofPattern("d MMM yyyy");
    private static final Set<String> CLOSED_TASK_STATUSES = Set.of("COMPLETED", "DONE", "CANCELLED");
    private static final Set<String> CLOSED_PROJECT_STATUSES = Set.of("COMPLETED", "CANCELLED");
    private static final BigDecimal MAX_HOURS_PER_DAY = BigDecimal.valueOf(24);

    private final TimesheetRepository timesheetRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final ResourceRepository resourceRepository;
    private final ResourceAllocationRepository allocationRepository;
    private final ProjectRepository projectRepository;
    private final ProjectTaskRepository projectTaskRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;
    private final FieldAclEvaluator fieldAclEvaluator;
    private final ApprovalService approvalService;
    private final ResourceDisplayNames resourceNames;
    private final MailGateway mailGateway;
    private final OrganizationRepository organizationRepository;
    private final boolean allowFutureSubmission;

    public TimesheetService(
            TimesheetRepository timesheetRepository,
            TimeEntryRepository timeEntryRepository,
            ResourceRepository resourceRepository,
            ResourceAllocationRepository allocationRepository,
            ProjectRepository projectRepository,
            ProjectTaskRepository projectTaskRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            NotificationService notificationService,
            ApplicationEventPublisher eventPublisher,
            FieldAclEvaluator fieldAclEvaluator,
            ApprovalService approvalService,
            ResourceDisplayNames resourceNames,
            MailGateway mailGateway,
            OrganizationRepository organizationRepository,
            @Value("${crm.timesheet.allow-future-submission:false}") boolean allowFutureSubmission) {
        this.timesheetRepository = timesheetRepository;
        this.timeEntryRepository = timeEntryRepository;
        this.resourceRepository = resourceRepository;
        this.allocationRepository = allocationRepository;
        this.projectRepository = projectRepository;
        this.projectTaskRepository = projectTaskRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.eventPublisher = eventPublisher;
        this.fieldAclEvaluator = fieldAclEvaluator;
        this.approvalService = approvalService;
        this.resourceNames = resourceNames;
        this.mailGateway = mailGateway;
        this.organizationRepository = organizationRepository;
        this.allowFutureSubmission = allowFutureSubmission;
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String status,
            UUID resourceId,
            LocalDate weekStart,
            boolean billableOnly,
            boolean awaitingMyApproval,
            Pageable pageable) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        UUID ownerId = tenantAccess.ownerFilterOrNull();
        boolean projectScoped = isProjectScopedViewer(orgId, user);
        if (projectScoped) {
            // Project managers reach other people's timesheets through their projects, not their data scope.
            ownerId = null;
        }
        Page<Timesheet> page = timesheetRepository.search(
                orgId,
                blankToNull(status),
                resourceId,
                weekStart,
                billableOnly,
                regionIds,
                ownerId,
                awaitingMyApproval ? user.userId() : null,
                projectScoped ? user.userId() : null,
                pageable);

        Map<UUID, BigDecimal> totals = new HashMap<>();
        for (Map.Entry<UUID, List<TimeEntry>> sheet :
                visibleEntriesBySheet(page.getContent(), user, projectScoped).entrySet()) {
            totals.put(sheet.getKey(), sheet.getValue().stream()
                    .map(TimeEntry::getHours)
                    .reduce(BigDecimal.ZERO, BigDecimal::add));
        }
        Map<UUID, String> names = resourceNames.byResourceIds(
                page.getContent().stream().map(Timesheet::getResourceId).toList());
        List<TimesheetResponse> data = page.getContent().stream()
                .map(t -> TimesheetResponse.summary(t, totals.getOrDefault(t.getId(), BigDecimal.ZERO))
                        .withResourceName(names.get(t.getResourceId())))
                .toList();
        return new PageResult(data, PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public TimesheetResponse get(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_VIEW");
        Timesheet timesheet = requireVisibleTimesheet(id);
        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(id);
        Set<UUID> projectScope = projectScope(timesheet, requireResource(timesheet.getResourceId()), entries, user);
        if (projectScope == null) {
            return detail(timesheet, entries, capacityWarning(timesheet, entries));
        }
        return scopedDetail(timesheet, entries, projectScope);
    }

    /** Projects the timesheet's resource is allocated to, with open tasks; used by the entry picker. */
    @Transactional(readOnly = true)
    public List<EntryProjectOption> entryProjects(UUID timesheetId) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_VIEW");
        Timesheet timesheet = requireVisibleTimesheet(timesheetId);
        List<EntryProjectOption> options =
                allocatedProjectOptions(timesheet.getOrganizationId(), timesheet.getResourceId());
        Set<UUID> projectScope = projectScope(
                timesheet,
                requireResource(timesheet.getResourceId()),
                timeEntryRepository.findActiveByTimesheetId(timesheetId),
                user);
        return projectScope == null
                ? options
                : options.stream().filter(option -> projectScope.contains(option.projectId())).toList();
    }

    /** Projects a resource can log time against, for pre-filling a timesheet before it exists. */
    @Transactional(readOnly = true)
    public List<EntryProjectOption> entryProjectsForResource(UUID resourceId) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        Resource resource = resolveWritableResource(resourceId, orgId, user);
        tenantAccess.assertRegionVisible(resource.getRegionId());
        return allocatedProjectOptions(orgId, resource.getId());
    }

    @Transactional
    public TimesheetResponse create(CreateTimesheetRequest request) {
        return create(request, null);
    }

    /**
     * Creates a draft for the caller's own resource, or — with {@value #PROXY_PERMISSION} — for a resource the
     * caller can see. {@code sourceOverride} marks imported sheets; otherwise the source is SELF or PROXY.
     */
    @Transactional
    public TimesheetResponse create(CreateTimesheetRequest request, String sourceOverride) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        LocalDate weekStart = requireMonday(request.weekStartDate());

        Resource resource = resolveWritableResource(request.resourceId(), orgId, user);
        tenantAccess.assertRegionVisible(resource.getRegionId());

        if (timesheetRepository.existsByResourceIdAndWeekStartDateAndDeletedAtIsNull(resource.getId(), weekStart)) {
            throw new ConflictException("A timesheet already exists for this resource and week");
        }

        Timesheet timesheet = Timesheet.create(orgId, resource.getId(), resource.getRegionId(), weekStart);
        String source = sourceOverride != null
                ? sourceOverride
                : isOwnResource(resource, user) ? Timesheet.SOURCE_SELF : Timesheet.SOURCE_PROXY;
        timesheet.recordEntry(source, user.userId());
        timesheet.updateNotes(blankToNull(request.notes()));
        timesheetRepository.save(timesheet);
        auditService.record(orgId, user.userId(), "CREATE", "TIMESHEET", timesheet.getId());

        TimesheetResponse result = detail(timesheet, List.of(), null);
        String startWith = request.startWith() == null ? START_BLANK : request.startWith();
        if (START_COPY_PREVIOUS.equals(startWith)) {
            result = copyPreviousWeek(timesheet.getId());
        } else if (START_QUICK_FILL.equals(startWith)) {
            if (request.quickFill() == null) {
                throw new BusinessException("QUICK_FILL_REQUIRED", "Choose a project and hours to pre-fill the week");
            }
            result = saveEntries(timesheet.getId(), quickFillEntries(weekStart, request.quickFill()));
        } else if (START_CUSTOM.equals(startWith) && request.entries() != null && !request.entries().isEmpty()) {
            result = saveEntries(timesheet.getId(), request.entries());
        }
        if (Boolean.TRUE.equals(request.submitAfterCreate())) {
            result = submit(timesheet.getId());
        }
        return result;
    }

    /** Today in the organization's time zone; hours after this date can be saved as a draft but not submitted. */
    public LocalDate todayFor(UUID organizationId) {
        ZoneId zone = organizationRepository.findById(organizationId)
                .map(org -> {
                    try {
                        return org.getTimezone() == null ? null : ZoneId.of(org.getTimezone());
                    } catch (DateTimeException ex) {
                        return null;
                    }
                })
                .orElse(null);
        return LocalDate.now(zone != null ? zone : ZoneId.systemDefault());
    }

    private void assertNoFutureEntries(UUID organizationId, Collection<LocalDate> workDates) {
        if (allowFutureSubmission) {
            return;
        }
        LocalDate today = todayFor(organizationId);
        workDates.stream()
                .filter(Objects::nonNull)
                .filter(date -> date.isAfter(today))
                .min(LocalDate::compareTo)
                .ifPresent(date -> {
                    throw new BusinessException(
                            "FUTURE_ENTRIES",
                            "Hours are logged for a future date (" + date.format(WEEK_LABEL)
                                    + "). Save the week as a draft and submit it once those days have passed.");
                });
    }

    private static List<LinkEntryRequest> quickFillEntries(LocalDate weekStart, QuickFillRequest fill) {
        return fill.days().stream()
                .distinct()
                .sorted()
                .map(day -> new LinkEntryRequest(
                        fill.projectId(),
                        fill.taskId(),
                        weekStart.plusDays(day - 1L),
                        fill.hoursPerDay(),
                        fill.description(),
                        fill.billable() == null || fill.billable()))
                .toList();
    }

    /**
     * Returns the id of the editable timesheet for this resource and week, creating it when missing. Used by the
     * spreadsheet import, which may add rows to a draft that already exists.
     */
    @Transactional
    public UUID findOrCreateEditable(UUID organizationId, UUID resourceId, LocalDate weekStart, String source) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        LocalDate monday = requireMonday(weekStart);
        Resource resource = resolveWritableResource(resourceId, orgId, user);
        Timesheet existing = timesheetRepository
                .findByResourceIdAndWeekStartDateAndDeletedAtIsNull(resource.getId(), monday)
                .orElse(null);
        if (existing != null) {
            if (!existing.isEditable()) {
                throw new BusinessException(
                        "INVALID_STATUS",
                        "The week of " + monday.format(WEEK_LABEL) + " is already " + existing.getStatus().toLowerCase());
            }
            return existing.getId();
        }
        return create(new CreateTimesheetRequest(orgId, resource.getId(), monday), source).id();
    }

    @Transactional
    public TimesheetResponse update(UUID id, UpdateTimesheetRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        Timesheet timesheet = requireVisibleTimesheet(id);
        assertCanEdit(timesheet, user);
        assertEditable(timesheet);
        if (request != null
                && request.version() != null
                && timesheet.getVersion() != null
                && !request.version().equals(timesheet.getVersion())) {
            throw new ConflictException("Timesheet was modified by another request");
        }
        if (request != null && request.notes() != null) {
            timesheet.updateNotes(blankToNull(request.notes()));
        }
        auditService.record(timesheet.getOrganizationId(), user.userId(), "UPDATE", "TIMESHEET", timesheet.getId());
        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(id);
        return detail(timesheet, entries, capacityWarning(timesheet, entries));
    }

    @Transactional
    public TimeEntryResponse addEntry(UUID timesheetId, CreateTimeEntryRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        Timesheet timesheet = requireVisibleTimesheet(timesheetId);
        assertCanEdit(timesheet, user);
        assertEditable(timesheet);
        assertWorkDateInWeek(timesheet, request.workDate());
        validateHours(request.hours());

        Project project = requireProjectForEntry(
                request.projectId(), timesheet.getOrganizationId(), timesheet.getResourceId());
        UUID taskId = resolveTaskId(request.taskId(), project.getId(), timesheet.getOrganizationId());
        BigDecimal billingRate =
                request.billingRate() != null ? request.billingRate() : snapshotBillingRate(timesheet.getResourceId());

        TimeEntry entry = TimeEntry.create(
                timesheet.getOrganizationId(),
                timesheet.getId(),
                project.getId(),
                taskId,
                request.workDate(),
                request.hours(),
                blankToNull(request.description()),
                request.billable() == null || request.billable(),
                billingRate);
        timeEntryRepository.save(entry);
        auditService.record(timesheet.getOrganizationId(), user.userId(), "CREATE", "TIME_ENTRY", entry.getId());
        return TimeEntryResponse.from(entry, canViewRates());
    }

    @Transactional
    public TimeEntryResponse updateEntry(UUID entryId, UpdateTimeEntryRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        TimeEntry entry = timeEntryRepository
                .findActiveById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        Timesheet timesheet = requireVisibleTimesheet(entry.getTimesheetId());
        assertCanEdit(timesheet, user);
        assertEditable(timesheet);
        assertProjectOpen(entry.getProjectId());

        if (request.workDate() != null) {
            assertWorkDateInWeek(timesheet, request.workDate());
        }
        if (request.hours() != null) {
            validateHours(request.hours());
        }

        UUID projectId = request.projectId();
        if (projectId != null) {
            requireProjectForEntry(projectId, timesheet.getOrganizationId(), timesheet.getResourceId());
        } else {
            projectId = entry.getProjectId();
        }

        UUID taskId = entry.getTaskId();
        if (Boolean.TRUE.equals(request.clearTask())) {
            entry.clearTaskId();
            taskId = null;
        } else if (request.taskId() != null) {
            taskId = resolveTaskId(request.taskId(), projectId, timesheet.getOrganizationId());
        }

        entry.update(
                request.projectId(),
                taskId,
                request.workDate(),
                request.hours(),
                request.description(),
                request.billable(),
                request.billingRate());
        auditService.record(timesheet.getOrganizationId(), user.userId(), "UPDATE", "TIME_ENTRY", entry.getId());
        return TimeEntryResponse.from(entry, canViewRates());
    }

    @Transactional
    public void deleteEntry(UUID entryId) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        TimeEntry entry = timeEntryRepository
                .findActiveById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        Timesheet timesheet = requireVisibleTimesheet(entry.getTimesheetId());
        assertCanEdit(timesheet, user);
        assertEditable(timesheet);
        assertProjectOpen(entry.getProjectId());
        entry.markDeleted();
        auditService.record(timesheet.getOrganizationId(), user.userId(), "DELETE", "TIME_ENTRY", entry.getId());
    }

    /** Weekly grid save: replaces every entry of an editable timesheet in one call. */
    @Transactional
    public TimesheetResponse saveEntries(UUID timesheetId, List<LinkEntryRequest> requests) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        Timesheet timesheet = requireVisibleTimesheet(timesheetId);
        assertCanEdit(timesheet, user);
        assertEditable(timesheet);

        List<TimeEntry> frozen = clearReplaceableEntries(timesheetId);
        Map<LocalDate, BigDecimal> hoursByDay = new HashMap<>();
        for (TimeEntry entry : frozen) {
            hoursByDay.merge(entry.getWorkDate(), entry.getHours(), BigDecimal::add);
        }
        Map<UUID, Project> projects = new HashMap<>();
        for (LinkEntryRequest request : requests) {
            assertWorkDateInWeek(timesheet, request.workDate());
            validateHours(request.hours());
            projects.computeIfAbsent(
                    request.projectId(),
                    projectId -> requireProjectForEntry(projectId, timesheet.getOrganizationId(), timesheet.getResourceId()));
            BigDecimal dayTotal = hoursByDay.merge(request.workDate(), request.hours(), BigDecimal::add);
            if (dayTotal.compareTo(MAX_HOURS_PER_DAY) > 0) {
                throw new BusinessException(
                        "DAILY_LIMIT_EXCEEDED", "More than 24 hours logged on " + request.workDate());
            }
        }

        BigDecimal billingRate = snapshotBillingRate(timesheet.getResourceId());
        List<TimeEntry> saved = new ArrayList<>(frozen);
        for (LinkEntryRequest request : requests) {
            UUID taskId = resolveTaskId(request.taskId(), request.projectId(), timesheet.getOrganizationId());
            saved.add(timeEntryRepository.save(TimeEntry.create(
                    timesheet.getOrganizationId(),
                    timesheet.getId(),
                    request.projectId(),
                    taskId,
                    request.workDate(),
                    request.hours(),
                    blankToNull(request.description()),
                    request.billable() == null || request.billable(),
                    billingRate)));
        }
        auditService.record(timesheet.getOrganizationId(), user.userId(), "UPDATE", "TIMESHEET", timesheet.getId());
        saved.sort(java.util.Comparator.comparing(TimeEntry::getWorkDate));
        return detail(timesheet, saved, capacityWarning(timesheet, saved));
    }

    /**
     * Copies the previous week's entries (same projects, tasks, hours and notes, shifted by seven days) into an
     * empty editable timesheet. Entries for projects the resource can no longer log against are skipped.
     */
    @Transactional
    public TimesheetResponse copyPreviousWeek(UUID timesheetId) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        Timesheet timesheet = requireVisibleTimesheet(timesheetId);
        assertCanEdit(timesheet, user);
        assertEditable(timesheet);
        if (!timeEntryRepository.findActiveByTimesheetId(timesheetId).isEmpty()) {
            throw new BusinessException(
                    "HAS_ENTRIES", "This week already has entries; clear them before copying the previous week");
        }
        Timesheet previous = timesheetRepository
                .findByResourceIdAndWeekStartDateAndDeletedAtIsNull(
                        timesheet.getResourceId(), timesheet.getWeekStartDate().minusWeeks(1))
                .orElseThrow(() -> new BusinessException("NO_PREVIOUS_WEEK", "There is no timesheet for the previous week"));
        List<TimeEntry> source = timeEntryRepository.findActiveByTimesheetId(previous.getId());
        if (source.isEmpty()) {
            throw new BusinessException("NO_PREVIOUS_WEEK", "The previous week has no entries to copy");
        }

        Set<UUID> allowedProjects = new java.util.HashSet<>();
        Set<UUID> blockedProjects = new java.util.HashSet<>();
        BigDecimal billingRate = snapshotBillingRate(timesheet.getResourceId());
        List<TimeEntry> copies = new ArrayList<>();
        for (TimeEntry entry : source) {
            UUID projectId = entry.getProjectId();
            if (blockedProjects.contains(projectId)) {
                continue;
            }
            if (!allowedProjects.contains(projectId)) {
                try {
                    requireProjectForEntry(projectId, timesheet.getOrganizationId(), timesheet.getResourceId());
                    allowedProjects.add(projectId);
                } catch (BusinessException | ResourceNotFoundException | ForbiddenException ex) {
                    blockedProjects.add(projectId);
                    continue;
                }
            }
            UUID taskId = entry.getTaskId() != null
                    && projectTaskRepository.findActiveById(entry.getTaskId())
                            .filter(task -> !CLOSED_TASK_STATUSES.contains(task.getStatus()))
                            .isPresent()
                    ? entry.getTaskId()
                    : null;
            copies.add(timeEntryRepository.save(TimeEntry.create(
                    timesheet.getOrganizationId(),
                    timesheet.getId(),
                    projectId,
                    taskId,
                    entry.getWorkDate().plusWeeks(1),
                    entry.getHours(),
                    entry.getDescription(),
                    entry.isBillable(),
                    billingRate)));
        }
        if (copies.isEmpty()) {
            throw new BusinessException(
                    "NOTHING_TO_COPY", "None of last week's projects can be logged against any more");
        }
        auditService.record(timesheet.getOrganizationId(), user.userId(), "UPDATE", "TIMESHEET", timesheet.getId());
        return detail(timesheet, copies, capacityWarning(timesheet, copies));
    }

    @Transactional
    public TimesheetResponse submit(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_SUBMIT");
        Timesheet timesheet = requireVisibleTimesheet(id);
        assertCanEdit(timesheet, user);
        if (!timesheet.isEditable()) {
            throw new BusinessException("INVALID_STATUS", "Only draft or rejected timesheets can be submitted");
        }
        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(id);
        if (entries.isEmpty()) {
            throw new BusinessException("NO_ENTRIES", "Add at least one time entry before submitting");
        }
        assertNoFutureEntries(timesheet.getOrganizationId(), entries.stream().map(TimeEntry::getWorkDate).toList());

        timesheet.submit();
        auditService.record(timesheet.getOrganizationId(), user.userId(), "UPDATE", "TIMESHEET", timesheet.getId());

        Resource resource = requireResource(timesheet.getResourceId());
        String weekLabel = timesheet.getWeekStartDate().format(WEEK_LABEL);
        String submitterName = user.displayName() != null ? user.displayName() : user.email();
        String message = isOwnResource(resource, user)
                ? submitterName + " submitted the week of " + weekLabel + "."
                : submitterName + " submitted the week of " + weekLabel + " on behalf of "
                        + resourceNames.of(resource) + ".";
        if (!Objects.equals(resource.getManagerId(), user.userId())) {
            notificationService.notify(
                    timesheet.getOrganizationId(),
                    resource.getManagerId(),
                    "TIMESHEET_SUBMITTED",
                    "Timesheet submitted",
                    message,
                    "TIMESHEET",
                    timesheet.getId());
        }
        eventPublisher.publishEvent(
                new TimesheetSubmittedEvent(timesheet.getOrganizationId(), timesheet.getId(), timesheet.getResourceId()));
        approvalService.openTimesheetRequest(timesheet, user.userId());

        return detail(timesheet, entries, capacityWarning(timesheet, entries));
    }

    /**
     * Replaces the week's entries and submits it for approval on behalf of a resource that has no login. The
     * caller (secure link service) has already authenticated the request by its token; entries must be for
     * projects the resource is allocated to.
     */
    @Transactional
    public Timesheet submitFromLink(
            Resource resource, LocalDate weekStart, List<LinkEntryRequest> requests, UUID approvalRequestedBy) {
        LocalDate monday = requireMonday(weekStart);
        Timesheet timesheet = timesheetRepository
                .findByResourceIdAndWeekStartDateAndDeletedAtIsNull(resource.getId(), monday)
                .orElse(null);
        if (timesheet == null) {
            timesheet = Timesheet.create(resource.getOrganizationId(), resource.getId(), resource.getRegionId(), monday);
            timesheetRepository.save(timesheet);
        } else if (!timesheet.isEditable()) {
            throw new BusinessException(
                    "INVALID_STATUS", "This week is already " + timesheet.getStatus().toLowerCase() + " and can't be changed");
        }
        timesheet.recordEntry(Timesheet.SOURCE_LINK, null);

        Set<UUID> allocatedProjects = new LinkedHashSet<>();
        for (ResourceAllocation allocation : allocationRepository.findActiveOrPlannedByResource(resource.getId())) {
            allocatedProjects.add(allocation.getProjectId());
        }
        assertNoFutureEntries(resource.getOrganizationId(), requests.stream().map(LinkEntryRequest::workDate).toList());
        clearReplaceableEntries(timesheet.getId());
        BigDecimal billingRate = ResourceMetrics.hourlyBillingRate(resource);
        for (LinkEntryRequest request : requests) {
            assertWorkDateInWeek(timesheet, request.workDate());
            validateHours(request.hours());
            if (!allocatedProjects.contains(request.projectId())) {
                throw new BusinessException(
                        "NOT_ALLOCATED", "You can only log time against projects you are allocated to");
            }
            if (isProjectClosed(request.projectId())) {
                throw new BusinessException(
                        "PROJECT_CLOSED", "The project has ended; time can no longer be logged against it");
            }
            UUID taskId = resolveTaskId(request.taskId(), request.projectId(), resource.getOrganizationId());
            timeEntryRepository.save(TimeEntry.create(
                    resource.getOrganizationId(),
                    timesheet.getId(),
                    request.projectId(),
                    taskId,
                    request.workDate(),
                    request.hours(),
                    blankToNull(request.description()),
                    request.billable() == null || request.billable(),
                    billingRate));
        }

        timesheet.submit();
        auditService.record(resource.getOrganizationId(), null, "SUBMIT_VIA_LINK", "TIMESHEET", timesheet.getId());
        notificationService.notify(
                resource.getOrganizationId(),
                resource.getManagerId(),
                "TIMESHEET_SUBMITTED",
                "Timesheet submitted",
                resourceNames.of(resource) + " submitted the week of " + monday.format(WEEK_LABEL)
                        + " through a secure link.",
                "TIMESHEET",
                timesheet.getId());
        eventPublisher.publishEvent(
                new TimesheetSubmittedEvent(resource.getOrganizationId(), timesheet.getId(), resource.getId()));
        UUID submitter = approvalRequestedBy != null ? approvalRequestedBy : resource.getManagerId();
        if (submitter != null) {
            approvalService.openTimesheetRequest(timesheet, submitter);
        }
        return timesheet;
    }

    @Transactional
    public TimesheetResponse approve(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_APPROVE");
        Timesheet timesheet = requireVisibleTimesheet(id);
        if (!Timesheet.STATUS_SUBMITTED.equals(timesheet.getStatus())) {
            throw new BusinessException("INVALID_STATUS", "Only submitted timesheets can be approved");
        }
        Resource resource = requireResource(timesheet.getResourceId());
        assertNotSelfApprove(user, resource);

        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(id);
        Set<UUID> projectScope = projectScope(timesheet, resource, entries, user);
        List<TimeEntry> approvable = inScope(entries, projectScope);
        if (projectScope != null && approvable.isEmpty()) {
            throw new ForbiddenException("You can only approve hours on projects you manage");
        }
        approvable.stream().filter(entry -> !entry.isApproved()).forEach(entry -> entry.approve(user.userId()));
        auditService.record(timesheet.getOrganizationId(), user.userId(), "APPROVE", "TIMESHEET", timesheet.getId());
        if (!entries.stream().allMatch(TimeEntry::isApproved)) {
            // Other project managers still have to approve the hours on their projects.
            timeEntryRepository.saveAll(approvable);
            return scopedDetail(timesheet, entries, projectScope);
        }

        timesheet.approve(user.userId());
        timesheetRepository.saveAndFlush(timesheet);
        stampRates(resource, entries);
        recomputeActualHours(entries);

        String weekLabel = timesheet.getWeekStartDate().format(WEEK_LABEL);
        String message = "Your timesheet for the week of " + weekLabel + " was approved.";
        notificationService.notify(
                timesheet.getOrganizationId(),
                resource.getUserId(),
                "TIMESHEET_APPROVED",
                "Timesheet approved",
                message,
                "TIMESHEET",
                timesheet.getId());
        emailResourceWithoutLogin(resource, "Timesheet approved", message);
        eventPublisher.publishEvent(
                new TimesheetApprovedEvent(timesheet.getOrganizationId(), timesheet.getId(), user.userId()));
        approvalService.syncApprove(
                timesheet.getOrganizationId(),
                ApprovalService.TARGET_TIMESHEET,
                timesheet.getId(),
                user.userId(),
                null);

        return scopedDetail(timesheet, entries, projectScope);
    }

    /**
     * Freezes the allocation and rates each approved hour was worked under, so later rate changes
     * never rewrite historical cost or revenue.
     */
    private void stampRates(Resource resource, List<TimeEntry> entries) {
        Map<UUID, List<ResourceAllocation>> byProject = new HashMap<>();
        for (TimeEntry entry : entries) {
            if (entry.getProjectId() == null) {
                entry.stampRates(null, ResourceMetrics.hourlyCostRate(resource), null);
                continue;
            }
            List<ResourceAllocation> allocations = byProject.computeIfAbsent(
                    entry.getProjectId(),
                    projectId -> allocationRepository.findHistoryForResourceAndProject(resource.getId(), projectId));
            ResourceAllocation allocation = ResourceMetrics.allocationCovering(allocations, entry.getWorkDate());
            entry.stampRates(
                    allocation == null ? null : allocation.getId(),
                    ResourceMetrics.costRateFor(allocation, resource),
                    ResourceMetrics.billingRateFor(allocation, resource));
        }
    }

    @Transactional
    public TimesheetResponse reject(UUID id, RejectTimesheetRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_APPROVE");
        Timesheet timesheet = requireVisibleTimesheet(id);
        if (!Timesheet.STATUS_SUBMITTED.equals(timesheet.getStatus())) {
            throw new BusinessException("INVALID_STATUS", "Only submitted timesheets can be rejected");
        }
        Resource resource = requireResource(timesheet.getResourceId());
        assertNotSelfApprove(user, resource);
        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(id);
        Set<UUID> projectScope = projectScope(timesheet, resource, entries, user);
        if (projectScope != null && inScope(entries, projectScope).isEmpty()) {
            throw new ForbiddenException("You can only reject hours on projects you manage");
        }
        // The resource corrects and resubmits the whole week, so every project is approved again.
        entries.forEach(TimeEntry::clearApproval);

        String reason = request.reason().trim();
        timesheet.reject(user.userId(), reason);
        auditService.record(timesheet.getOrganizationId(), user.userId(), "REJECT", "TIMESHEET", timesheet.getId());

        String weekLabel = timesheet.getWeekStartDate().format(WEEK_LABEL);
        String message = "Your timesheet for the week of " + weekLabel + " was rejected: " + reason;
        notificationService.notify(
                timesheet.getOrganizationId(),
                resource.getUserId(),
                "TIMESHEET_REJECTED",
                "Timesheet rejected",
                message,
                "TIMESHEET",
                timesheet.getId());
        emailResourceWithoutLogin(
                resource,
                "Timesheet rejected",
                message + "\n\nOpen the timesheet link again to correct it, or ask your manager for a new link.");
        eventPublisher.publishEvent(
                new TimesheetRejectedEvent(timesheet.getOrganizationId(), timesheet.getId(), user.userId(), reason));
        approvalService.syncReject(
                timesheet.getOrganizationId(),
                ApprovalService.TARGET_TIMESHEET,
                timesheet.getId(),
                user.userId(),
                reason);

        return scopedDetail(timesheet, entries, projectScope);
    }

    @Transactional(readOnly = true)
    public String exportCsv(UUID organizationId) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_EXPORT");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        boolean projectScoped = isProjectScopedViewer(orgId, user);
        UUID ownerId = projectScoped ? null : tenantAccess.ownerFilterOrNull();
        List<Timesheet> timesheets = timesheetRepository.findAllForExport(orgId, regionIds, ownerId);
        Map<UUID, List<TimeEntry>> entriesBySheet = visibleEntriesBySheet(timesheets, user, projectScoped);
        if (projectScoped) {
            timesheets = timesheets.stream().filter(t -> entriesBySheet.containsKey(t.getId())).toList();
        }

        StringBuilder csv = new StringBuilder();
        csv.append(
                "timesheetId,resourceId,weekStartDate,status,entryId,projectId,taskId,workDate,hours,billable,description\n");
        for (Timesheet timesheet : timesheets) {
            List<TimeEntry> entries = entriesBySheet.getOrDefault(timesheet.getId(), List.of());
            if (entries.isEmpty()) {
                csv.append(csvEscape(timesheet.getId().toString()))
                        .append(',')
                        .append(csvEscape(timesheet.getResourceId().toString()))
                        .append(',')
                        .append(csvEscape(timesheet.getWeekStartDate().toString()))
                        .append(',')
                        .append(csvEscape(timesheet.getStatus()))
                        .append(",,,,,,\n");
                continue;
            }
            for (TimeEntry entry : entries) {
                csv.append(csvEscape(timesheet.getId().toString()))
                        .append(',')
                        .append(csvEscape(timesheet.getResourceId().toString()))
                        .append(',')
                        .append(csvEscape(timesheet.getWeekStartDate().toString()))
                        .append(',')
                        .append(csvEscape(timesheet.getStatus()))
                        .append(',')
                        .append(csvEscape(entry.getId().toString()))
                        .append(',')
                        .append(csvEscape(entry.getProjectId().toString()))
                        .append(',')
                        .append(csvEscape(entry.getTaskId() != null ? entry.getTaskId().toString() : ""))
                        .append(',')
                        .append(csvEscape(entry.getWorkDate().toString()))
                        .append(',')
                        .append(csvEscape(entry.getHours().toPlainString()))
                        .append(',')
                        .append(entry.isBillable())
                        .append(',')
                        .append(csvEscape(entry.getDescription()))
                        .append('\n');
            }
        }
        return csv.toString();
    }

    /** Allocated (active or planned) projects of a resource with their open tasks. */
    @Transactional(readOnly = true)
    public List<EntryProjectOption> allocatedProjectOptions(UUID organizationId, UUID resourceId) {
        Set<UUID> projectIds = new LinkedHashSet<>();
        for (ResourceAllocation allocation : allocationRepository.findActiveOrPlannedByResource(resourceId)) {
            projectIds.add(allocation.getProjectId());
        }
        if (projectIds.isEmpty()) {
            return List.of();
        }
        Map<UUID, Project> projects = new HashMap<>();
        for (Project project : projectRepository.findAllById(projectIds)) {
            if (project.getDeletedAt() == null && organizationId.equals(project.getOrganizationId())) {
                projects.put(project.getId(), project);
            }
        }
        List<EntryProjectOption> options = new ArrayList<>();
        for (UUID projectId : projectIds) {
            Project project = projects.get(projectId);
            if (project == null) {
                continue;
            }
            List<EntryTaskOption> tasks = projectTaskRepository.findByProjectId(projectId).stream()
                    .filter(task -> !CLOSED_TASK_STATUSES.contains(task.getStatus()))
                    .filter(task -> task.getAssignedResourceId() == null
                            || task.getAssignedResourceId().equals(resourceId))
                    .map(task -> new EntryTaskOption(task.getId(), task.getName(), task.getStatus()))
                    .toList();
            boolean closed = isProjectClosed(project);
            options.add(new EntryProjectOption(
                    project.getId(),
                    project.getName(),
                    project.getProjectCode(),
                    project.getStatus(),
                    closed,
                    closed ? List.of() : tasks));
        }
        return options;
    }

    private TimesheetResponse detail(Timesheet timesheet, List<TimeEntry> entries, String warning) {
        String name = resourceRepository
                .findActiveById(timesheet.getResourceId())
                .map(resourceNames::of)
                .orElse(null);
        return TimesheetResponse.from(timesheet, entries, warning, canViewRates()).withResourceName(name);
    }

    private void emailResourceWithoutLogin(Resource resource, String subject, String body) {
        if (resource.getUserId() == null && resource.getEmail() != null) {
            mailGateway.send(resource.getEmail(), subject, "Hi " + resourceNames.of(resource) + ",\n\n" + body);
        }
    }

    private Timesheet requireVisibleTimesheet(UUID id) {
        Timesheet timesheet = timesheetRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        Resource resource = requireResource(timesheet.getResourceId());
        try {
            tenantAccess.assertRecordVisible(TimesheetScope.of(timesheet, resource));
        } catch (ResourceNotFoundException outsideScope) {
            // A project manager may open any timesheet with hours on their projects; get() limits what they see.
            CurrentUser user = tenantAccess.currentUser();
            if (managedProjectIds(timeEntryRepository.findActiveByTimesheetId(id), user).isEmpty()) {
                throw outsideScope;
            }
        }
        return timesheet;
    }

    /**
     * Users who manage projects see other people's timesheets project by project: only the hours on projects they
     * manage. Approval admins are exempt.
     */
    private boolean isProjectScopedViewer(UUID organizationId, CurrentUser user) {
        return user.userId() != null
                && !user.hasPermission("APPROVAL_ADMIN")
                && projectRepository.existsByOrganizationIdAndProjectManagerIdAndDeletedAtIsNull(
                        organizationId, user.userId());
    }

    /**
     * Projects whose entries the user may see and act on in this timesheet, or {@code null} when they see every entry
     * (their own timesheet, the resource's reporting manager, or a viewer who manages no projects).
     */
    private Set<UUID> projectScope(Timesheet timesheet, Resource resource, List<TimeEntry> entries, CurrentUser user) {
        if (isOwnResource(resource, user)
                || Objects.equals(resource.getManagerId(), user.userId())
                || !isProjectScopedViewer(timesheet.getOrganizationId(), user)) {
            return null;
        }
        return managedProjectIds(entries, user);
    }

    private Set<UUID> managedProjectIds(Collection<TimeEntry> entries, CurrentUser user) {
        Set<UUID> projectIds = new LinkedHashSet<>();
        entries.forEach(entry -> projectIds.add(entry.getProjectId()));
        Set<UUID> managed = new LinkedHashSet<>();
        if (projectIds.isEmpty() || user.userId() == null) {
            return managed;
        }
        for (Project project : projectRepository.findAllById(projectIds)) {
            if (Objects.equals(project.getProjectManagerId(), user.userId())) {
                managed.add(project.getId());
            }
        }
        return managed;
    }

    private static List<TimeEntry> inScope(List<TimeEntry> entries, Set<UUID> projectScope) {
        return projectScope == null
                ? entries
                : entries.stream().filter(entry -> projectScope.contains(entry.getProjectId())).toList();
    }

    private TimesheetResponse scopedDetail(Timesheet timesheet, List<TimeEntry> entries, Set<UUID> projectScope) {
        if (projectScope == null) {
            return detail(timesheet, entries, null);
        }
        return detail(timesheet, inScope(entries, projectScope), null)
                .withVisibility(TimesheetResponse.VISIBILITY_MY_PROJECTS);
    }

    /** Entries per timesheet that the user may see; project-scoped viewers lose sheets with nothing visible. */
    private Map<UUID, List<TimeEntry>> visibleEntriesBySheet(
            List<Timesheet> timesheets, CurrentUser user, boolean projectScoped) {
        Map<UUID, List<TimeEntry>> bySheet = new HashMap<>();
        List<UUID> ids = timesheets.stream().map(Timesheet::getId).toList();
        if (ids.isEmpty()) {
            return bySheet;
        }
        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetIdIn(ids);
        Set<UUID> managed = projectScoped ? managedProjectIds(entries, user) : Set.of();
        Set<UUID> fullSheets = new LinkedHashSet<>();
        if (projectScoped) {
            Map<UUID, Resource> resources = new HashMap<>();
            resourceRepository.findAllById(timesheets.stream().map(Timesheet::getResourceId).toList())
                    .forEach(resource -> resources.put(resource.getId(), resource));
            for (Timesheet timesheet : timesheets) {
                Resource resource = resources.get(timesheet.getResourceId());
                if (resource != null
                        && (isOwnResource(resource, user) || Objects.equals(resource.getManagerId(), user.userId()))) {
                    fullSheets.add(timesheet.getId());
                }
            }
        }
        for (TimeEntry entry : entries) {
            if (!projectScoped || fullSheets.contains(entry.getTimesheetId()) || managed.contains(entry.getProjectId())) {
                bySheet.computeIfAbsent(entry.getTimesheetId(), ignored -> new ArrayList<>()).add(entry);
            }
        }
        if (!projectScoped) {
            return bySheet;
        }
        fullSheets.forEach(id -> bySheet.putIfAbsent(id, new ArrayList<>()));
        return bySheet;
    }

    /** Whether the user should see this timesheet's pending approval request in their inbox. */
    @Transactional(readOnly = true)
    public boolean canReviewTimesheet(Timesheet timesheet, Resource resource, CurrentUser user) {
        if (user.hasPermission("APPROVAL_ADMIN") || Objects.equals(resource.getManagerId(), user.userId())) {
            return true;
        }
        if (!isProjectScopedViewer(timesheet.getOrganizationId(), user)) {
            return user.hasPermission("APPROVAL_VIEW");
        }
        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(timesheet.getId());
        Set<UUID> managed = managedProjectIds(entries, user);
        return entries.stream().anyMatch(entry -> !entry.isApproved() && managed.contains(entry.getProjectId()));
    }

    private Resource resolveWritableResource(UUID requestedResourceId, UUID orgId, CurrentUser user) {
        UUID resourceId = requestedResourceId != null ? requestedResourceId : user.resourceId();
        if (resourceId == null) {
            throw new BusinessException(
                    "RESOURCE_REQUIRED", "No resource is linked to the current user; choose the resource to enter time for");
        }
        Resource resource = requireResource(resourceId);
        if (!resource.getOrganizationId().equals(orgId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        tenantAccess.assertRecordVisible(resource);
        if (!isOwnResource(resource, user) && !user.hasPermission(PROXY_PERMISSION)) {
            throw new ForbiddenException("You can only create timesheets for your own resource");
        }
        return resource;
    }

    /** Own timesheets are always editable by their owner; others need proxy rights over a visible resource. */
    private void assertCanEdit(Timesheet timesheet, CurrentUser user) {
        Resource resource = requireResource(timesheet.getResourceId());
        if (isOwnResource(resource, user)) {
            return;
        }
        if (!user.hasPermission(PROXY_PERMISSION)) {
            throw new ForbiddenException("You can only edit your own timesheets");
        }
        tenantAccess.assertRecordVisible(resource);
    }

    private static boolean isOwnResource(Resource resource, CurrentUser user) {
        return resource.getUserId() != null && Objects.equals(resource.getUserId(), user.userId());
    }

    private void assertNotSelfApprove(CurrentUser user, Resource resource) {
        if (Objects.equals(user.userId(), resource.getUserId()) && !user.hasPermission("TIMESHEET_SELF_APPROVE")) {
            throw new ForbiddenException("You cannot approve or reject your own timesheet");
        }
    }

    private void assertEditable(Timesheet timesheet) {
        if (!timesheet.isEditable()) {
            throw new BusinessException("INVALID_STATUS", "Timesheet can only be edited while draft or rejected");
        }
    }

    private LocalDate requireMonday(LocalDate weekStartDate) {
        if (weekStartDate == null) {
            throw new BusinessException("INVALID_WEEK_START", "weekStartDate is required");
        }
        if (weekStartDate.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new BusinessException("INVALID_WEEK_START", "weekStartDate must be a Monday");
        }
        return weekStartDate;
    }

    private void assertWorkDateInWeek(Timesheet timesheet, LocalDate workDate) {
        LocalDate start = timesheet.getWeekStartDate();
        LocalDate end = start.plusDays(6);
        if (workDate.isBefore(start) || workDate.isAfter(end)) {
            throw new BusinessException("INVALID_WORK_DATE", "workDate must fall within the timesheet week");
        }
    }

    private void validateHours(BigDecimal hours) {
        if (hours == null || hours.compareTo(BigDecimal.ZERO) <= 0 || hours.compareTo(BigDecimal.valueOf(24)) > 0) {
            throw new BusinessException("INVALID_HOURS", "hours must be greater than 0 and at most 24");
        }
    }

    public static boolean isProjectClosed(Project project) {
        return CLOSED_PROJECT_STATUSES.contains(project.getStatus());
    }

    private boolean isProjectClosed(UUID projectId) {
        return projectRepository.findActiveById(projectId).map(TimesheetService::isProjectClosed).orElse(false);
    }

    private void assertProjectOpen(UUID projectId) {
        if (isProjectClosed(projectId)) {
            throw new BusinessException(
                    "PROJECT_CLOSED", "The project has ended; its time entries can no longer be changed");
        }
    }

    /**
     * Soft-deletes a timesheet's entries before they are replaced, except entries on ended projects: those are frozen
     * and returned so they stay on the timesheet.
     */
    private List<TimeEntry> clearReplaceableEntries(UUID timesheetId) {
        Map<UUID, Boolean> closedByProject = new HashMap<>();
        List<TimeEntry> kept = new ArrayList<>();
        for (TimeEntry existing : timeEntryRepository.findActiveByTimesheetId(timesheetId)) {
            if (closedByProject.computeIfAbsent(existing.getProjectId(), this::isProjectClosed)) {
                kept.add(existing);
            } else {
                existing.markDeleted();
            }
        }
        return kept;
    }

    private Project requireProjectForEntry(UUID projectId, UUID organizationId, UUID resourceId) {
        Project project = projectRepository
                .findActiveById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!project.getOrganizationId().equals(organizationId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        if (isProjectClosed(project)) {
            throw new BusinessException(
                    "PROJECT_CLOSED",
                    "Project " + project.getName() + " is " + project.getStatus().toLowerCase()
                            + "; time can no longer be logged against it");
        }
        // Employees (OWN/TEAM) log time against allocated projects, not only projects they "own".
        if (tenantAccess.ownerFilterOrNull() != null) {
            if (!allocationRepository.existsActiveOrPlannedForResourceAndProject(resourceId, projectId)) {
                throw new BusinessException(
                        "NOT_ALLOCATED", "Time can only be logged against projects the resource is allocated to");
            }
            return project;
        }
        tenantAccess.assertRecordVisible(project);
        return project;
    }

    private UUID resolveTaskId(UUID taskId, UUID projectId, UUID organizationId) {
        if (taskId == null) {
            return null;
        }
        ProjectTask task = projectTaskRepository
                .findActiveById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!task.getOrganizationId().equals(organizationId) || !task.getProjectId().equals(projectId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return task.getId();
    }

    private Resource requireResource(UUID resourceId) {
        return resourceRepository
                .findActiveById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
    }

    private BigDecimal snapshotBillingRate(UUID resourceId) {
        return ResourceMetrics.hourlyBillingRate(requireResource(resourceId));
    }

    private String capacityWarning(Timesheet timesheet, List<TimeEntry> entries) {
        Resource resource = requireResource(timesheet.getResourceId());
        BigDecimal total = entries.stream().map(TimeEntry::getHours).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal capacity = resource.getCapacityHoursPerWeek();
        if (capacity != null && total.compareTo(capacity) > 0) {
            return "WEEKLY_CAPACITY_EXCEEDED";
        }
        return null;
    }

    private Map<UUID, BigDecimal> totalsByTimesheet(List<UUID> timesheetIds) {
        Map<UUID, BigDecimal> totals = new HashMap<>();
        if (timesheetIds.isEmpty()) {
            return totals;
        }
        for (TimeEntry entry : timeEntryRepository.findActiveByTimesheetIdIn(timesheetIds)) {
            totals.merge(entry.getTimesheetId(), entry.getHours(), BigDecimal::add);
        }
        return totals;
    }

    /**
     * Recomputes actual hours of the touched projects and tasks from all approved entries, so the totals stay
     * correct however often timesheets are approved, rejected and re-approved.
     */
    private void recomputeActualHours(List<TimeEntry> entries) {
        timeEntryRepository.flush();
        Set<UUID> projectIds = new LinkedHashSet<>();
        Set<UUID> taskIds = new LinkedHashSet<>();
        for (TimeEntry entry : entries) {
            projectIds.add(entry.getProjectId());
            if (entry.getTaskId() != null) {
                taskIds.add(entry.getTaskId());
            }
        }
        for (UUID projectId : projectIds) {
            projectRepository.findActiveById(projectId).ifPresent(project -> {
                project.setActualHours(timeEntryRepository.sumApprovedHoursByProject(projectId));
                projectRepository.save(project);
            });
        }
        for (UUID taskId : taskIds) {
            projectTaskRepository.findActiveById(taskId).ifPresent(task -> {
                task.setActualHours(timeEntryRepository.sumApprovedHoursByTask(taskId));
                projectTaskRepository.save(task);
            });
        }
    }

    private boolean canViewRates() {
        return fieldAclEvaluator.canViewResourceRates();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String csvEscape(String value) {
        return com.techearnest.crm.common.csv.CsvCells.escape(value);
    }

    /** Convenience for tests / callers that want the Monday of a given date. */
    public static LocalDate mondayOf(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    public record PageResult(List<TimesheetResponse> data, PaginationMeta pagination) {}
}
