package com.techearnest.crm.timesheet.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.approval.application.ApprovalService;
import com.techearnest.crm.common.api.PaginationMeta;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.application.FieldAclEvaluator;
import com.techearnest.crm.notification.application.NotificationService;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.project.domain.ProjectTask;
import com.techearnest.crm.project.domain.ProjectTaskRepository;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocationRepository;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.CreateTimeEntryRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.CreateTimesheetRequest;
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
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TimesheetService {

    private static final DateTimeFormatter WEEK_LABEL = DateTimeFormatter.ofPattern("d MMM yyyy");

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
            ApprovalService approvalService) {
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
    }

    @Transactional(readOnly = true)
    public PageResult list(
            UUID organizationId,
            String status,
            UUID resourceId,
            LocalDate weekStart,
            boolean billableOnly,
            Pageable pageable) {
        tenantAccess.requirePermission("TIMESHEET_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        UUID ownerId = tenantAccess.ownerFilterOrNull();
        Page<Timesheet> page = timesheetRepository.search(
                orgId,
                blankToNull(status),
                resourceId,
                weekStart,
                billableOnly,
                regionIds,
                ownerId,
                pageable);

        Map<UUID, BigDecimal> totals = totalsByTimesheet(
                page.getContent().stream().map(Timesheet::getId).toList());
        List<TimesheetResponse> data = page.getContent().stream()
                .map(t -> TimesheetResponse.summary(t, totals.getOrDefault(t.getId(), BigDecimal.ZERO)))
                .toList();
        return new PageResult(data, PaginationMeta.from(page));
    }

    @Transactional(readOnly = true)
    public TimesheetResponse get(UUID id) {
        tenantAccess.requirePermission("TIMESHEET_VIEW");
        Timesheet timesheet = requireVisibleTimesheet(id);
        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(id);
        return TimesheetResponse.from(timesheet, entries, capacityWarning(timesheet, entries), canViewRates());
    }

    @Transactional
    public TimesheetResponse create(CreateTimesheetRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        LocalDate weekStart = requireMonday(request.weekStartDate());

        Resource resource = resolveWritableResource(request.resourceId(), orgId, user);
        tenantAccess.assertRegionVisible(resource.getRegionId());

        if (timesheetRepository.existsByResourceIdAndWeekStartDateAndDeletedAtIsNull(resource.getId(), weekStart)) {
            throw new ConflictException("A timesheet already exists for this resource and week");
        }

        Timesheet timesheet = Timesheet.create(orgId, resource.getId(), resource.getRegionId(), weekStart);
        timesheetRepository.save(timesheet);
        auditService.record(orgId, user.userId(), "CREATE", "TIMESHEET", timesheet.getId());
        return TimesheetResponse.from(timesheet, List.of(), null, canViewRates());
    }

    @Transactional
    public TimesheetResponse update(UUID id, UpdateTimesheetRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        Timesheet timesheet = requireVisibleTimesheet(id);
        assertOwnResourceForEdit(timesheet, user);
        assertEditable(timesheet);
        if (request != null
                && request.version() != null
                && timesheet.getVersion() != null
                && !request.version().equals(timesheet.getVersion())) {
            throw new ConflictException("Timesheet was modified by another request");
        }
        auditService.record(timesheet.getOrganizationId(), user.userId(), "UPDATE", "TIMESHEET", timesheet.getId());
        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(id);
        return TimesheetResponse.from(timesheet, entries, capacityWarning(timesheet, entries), canViewRates());
    }

    @Transactional
    public TimeEntryResponse addEntry(UUID timesheetId, CreateTimeEntryRequest request) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_CREATE");
        Timesheet timesheet = requireVisibleTimesheet(timesheetId);
        assertOwnResourceForEdit(timesheet, user);
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
        assertOwnResourceForEdit(timesheet, user);
        assertEditable(timesheet);

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
        assertOwnResourceForEdit(timesheet, user);
        assertEditable(timesheet);
        entry.markDeleted();
        auditService.record(timesheet.getOrganizationId(), user.userId(), "DELETE", "TIME_ENTRY", entry.getId());
    }

    @Transactional
    public TimesheetResponse submit(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("TIMESHEET_SUBMIT");
        Timesheet timesheet = requireVisibleTimesheet(id);
        assertOwnResourceForEdit(timesheet, user);
        if (!timesheet.isEditable()) {
            throw new BusinessException("INVALID_STATUS", "Only draft or rejected timesheets can be submitted");
        }
        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(id);
        if (entries.isEmpty()) {
            throw new BusinessException("NO_ENTRIES", "Add at least one time entry before submitting");
        }

        timesheet.submit();
        auditService.record(timesheet.getOrganizationId(), user.userId(), "UPDATE", "TIMESHEET", timesheet.getId());

        Resource resource = requireResource(timesheet.getResourceId());
        String weekLabel = timesheet.getWeekStartDate().format(WEEK_LABEL);
        String submitterName = user.displayName() != null ? user.displayName() : user.email();
        notificationService.notify(
                timesheet.getOrganizationId(),
                resource.getManagerId(),
                "TIMESHEET_SUBMITTED",
                "Timesheet submitted",
                submitterName + " submitted the week of " + weekLabel + ".",
                "TIMESHEET",
                timesheet.getId());
        eventPublisher.publishEvent(
                new TimesheetSubmittedEvent(timesheet.getOrganizationId(), timesheet.getId(), timesheet.getResourceId()));
        approvalService.openTimesheetRequest(timesheet, user.userId());

        return TimesheetResponse.from(timesheet, entries, capacityWarning(timesheet, entries), canViewRates());
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

        timesheet.approve(user.userId());
        auditService.record(timesheet.getOrganizationId(), user.userId(), "APPROVE", "TIMESHEET", timesheet.getId());

        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(id);
        applyApprovedHoursToProjects(entries);

        String weekLabel = timesheet.getWeekStartDate().format(WEEK_LABEL);
        notificationService.notify(
                timesheet.getOrganizationId(),
                resource.getUserId(),
                "TIMESHEET_APPROVED",
                "Timesheet approved",
                "Your timesheet for the week of " + weekLabel + " was approved.",
                "TIMESHEET",
                timesheet.getId());
        eventPublisher.publishEvent(
                new TimesheetApprovedEvent(timesheet.getOrganizationId(), timesheet.getId(), user.userId()));
        approvalService.syncApprove(
                timesheet.getOrganizationId(),
                ApprovalService.TARGET_TIMESHEET,
                timesheet.getId(),
                user.userId(),
                null);

        return TimesheetResponse.from(timesheet, entries, null, canViewRates());
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

        String reason = request.reason().trim();
        timesheet.reject(user.userId(), reason);
        auditService.record(timesheet.getOrganizationId(), user.userId(), "REJECT", "TIMESHEET", timesheet.getId());

        String weekLabel = timesheet.getWeekStartDate().format(WEEK_LABEL);
        notificationService.notify(
                timesheet.getOrganizationId(),
                resource.getUserId(),
                "TIMESHEET_REJECTED",
                "Timesheet rejected",
                "Your timesheet for the week of " + weekLabel + " was rejected: " + reason,
                "TIMESHEET",
                timesheet.getId());
        eventPublisher.publishEvent(
                new TimesheetRejectedEvent(timesheet.getOrganizationId(), timesheet.getId(), user.userId(), reason));
        approvalService.syncReject(
                timesheet.getOrganizationId(),
                ApprovalService.TARGET_TIMESHEET,
                timesheet.getId(),
                user.userId(),
                reason);

        List<TimeEntry> entries = timeEntryRepository.findActiveByTimesheetId(id);
        return TimesheetResponse.from(timesheet, entries, null, canViewRates());
    }

    @Transactional(readOnly = true)
    public String exportCsv(UUID organizationId) {
        tenantAccess.requirePermission("TIMESHEET_EXPORT");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Collection<UUID> regionIds = tenantAccess.regionFilterOrNull();
        UUID ownerId = tenantAccess.ownerFilterOrNull();
        List<Timesheet> timesheets = timesheetRepository.findAllForExport(orgId, regionIds, ownerId);
        List<UUID> ids = timesheets.stream().map(Timesheet::getId).toList();
        Map<UUID, List<TimeEntry>> entriesBySheet = new HashMap<>();
        if (!ids.isEmpty()) {
            for (TimeEntry entry : timeEntryRepository.findActiveByTimesheetIdIn(ids)) {
                entriesBySheet.computeIfAbsent(entry.getTimesheetId(), ignored -> new java.util.ArrayList<>()).add(entry);
            }
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

    private Timesheet requireVisibleTimesheet(UUID id) {
        Timesheet timesheet = timesheetRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        Resource resource = requireResource(timesheet.getResourceId());
        tenantAccess.assertRecordVisible(TimesheetScope.of(timesheet, resource));
        return timesheet;
    }

    private Resource resolveWritableResource(UUID requestedResourceId, UUID orgId, CurrentUser user) {
        UUID resourceId = requestedResourceId != null ? requestedResourceId : user.resourceId();
        if (resourceId == null) {
            throw new BusinessException("RESOURCE_REQUIRED", "No resource is linked to the current user");
        }
        Resource resource = requireResource(resourceId);
        if (!resource.getOrganizationId().equals(orgId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        tenantAccess.assertRecordVisible(resource);
        // TIMESHEET_CREATE is for the employee's own resource (linked user).
        if (!Objects.equals(resource.getUserId(), user.userId())) {
            throw new ForbiddenException("You can only create timesheets for your own resource");
        }
        return resource;
    }

    private void assertOwnResourceForEdit(Timesheet timesheet, CurrentUser user) {
        Resource resource = requireResource(timesheet.getResourceId());
        if (!Objects.equals(resource.getUserId(), user.userId())) {
            throw new ForbiddenException("You can only edit your own timesheets");
        }
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

    private Project requireProjectForEntry(UUID projectId, UUID organizationId, UUID resourceId) {
        Project project = projectRepository
                .findActiveById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (!project.getOrganizationId().equals(organizationId)) {
            throw new ResourceNotFoundException("Resource not found");
        }
        // Employees (OWN/TEAM) log time against allocated projects, not only projects they "own".
        if (tenantAccess.ownerFilterOrNull() != null) {
            if (!allocationRepository.existsActiveOrPlannedForResourceAndProject(resourceId, projectId)) {
                throw new BusinessException(
                        "NOT_ALLOCATED", "You can only log time against projects you are allocated to");
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
        Resource resource = requireResource(resourceId);
        return resource.getBillingRate();
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

    private void applyApprovedHoursToProjects(List<TimeEntry> entries) {
        Map<UUID, BigDecimal> hoursByProject = new HashMap<>();
        Map<UUID, BigDecimal> hoursByTask = new HashMap<>();
        for (TimeEntry entry : entries) {
            hoursByProject.merge(entry.getProjectId(), entry.getHours(), BigDecimal::add);
            if (entry.getTaskId() != null) {
                hoursByTask.merge(entry.getTaskId(), entry.getHours(), BigDecimal::add);
            }
        }
        for (Map.Entry<UUID, BigDecimal> projectHours : hoursByProject.entrySet()) {
            projectRepository.findActiveById(projectHours.getKey()).ifPresent(project -> {
                project.addActualHours(projectHours.getValue());
                projectRepository.save(project);
            });
        }
        for (Map.Entry<UUID, BigDecimal> taskHours : hoursByTask.entrySet()) {
            projectTaskRepository.findActiveById(taskHours.getKey()).ifPresent(task -> {
                task.addActualHours(taskHours.getValue());
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
