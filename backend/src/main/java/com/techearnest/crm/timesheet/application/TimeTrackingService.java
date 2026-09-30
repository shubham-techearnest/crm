package com.techearnest.crm.timesheet.application;

import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.application.FieldAclEvaluator;
import com.techearnest.crm.project.domain.Project;
import com.techearnest.crm.project.domain.ProjectRepository;
import com.techearnest.crm.project.domain.ProjectTask;
import com.techearnest.crm.project.domain.ProjectTaskRepository;
import com.techearnest.crm.resource.application.ResourceDisplayNames;
import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceRepository;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.ProjectTimeSummary;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.ResourceTimeSummary;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimeBucket;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimesheetWeek;
import com.techearnest.crm.timesheet.domain.TimeEntry;
import com.techearnest.crm.timesheet.domain.TimeEntryRepository;
import com.techearnest.crm.timesheet.domain.Timesheet;
import com.techearnest.crm.timesheet.domain.TimesheetRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Actual (timesheet-based) hours rolled up per project and per resource. */
@Service
public class TimeTrackingService {

    private static final long MAX_PERIOD_DAYS = 366;

    private final TimeEntryRepository timeEntryRepository;
    private final TimesheetRepository timesheetRepository;
    private final ProjectRepository projectRepository;
    private final ProjectTaskRepository projectTaskRepository;
    private final ResourceRepository resourceRepository;
    private final ResourceDisplayNames resourceNames;
    private final TenantAccess tenantAccess;
    private final FieldAclEvaluator fieldAclEvaluator;

    public TimeTrackingService(
            TimeEntryRepository timeEntryRepository,
            TimesheetRepository timesheetRepository,
            ProjectRepository projectRepository,
            ProjectTaskRepository projectTaskRepository,
            ResourceRepository resourceRepository,
            ResourceDisplayNames resourceNames,
            TenantAccess tenantAccess,
            FieldAclEvaluator fieldAclEvaluator) {
        this.timeEntryRepository = timeEntryRepository;
        this.timesheetRepository = timesheetRepository;
        this.projectRepository = projectRepository;
        this.projectTaskRepository = projectTaskRepository;
        this.resourceRepository = resourceRepository;
        this.resourceNames = resourceNames;
        this.tenantAccess = tenantAccess;
        this.fieldAclEvaluator = fieldAclEvaluator;
    }

    @Transactional(readOnly = true)
    public ProjectTimeSummary projectSummary(UUID projectId) {
        tenantAccess.requirePermission("PROJECT_VIEW");
        Project project = projectRepository
                .findActiveById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(project);

        List<TimeEntry> entries = timeEntryRepository.findActiveByProjectId(projectId);
        Map<UUID, Timesheet> sheets = sheetsFor(entries);
        Set<UUID> unbilledIds = new HashSet<>();
        timeEntryRepository
                .findUnbilledApprovedBillable(project.getOrganizationId(), projectId)
                .forEach(entry -> unbilledIds.add(entry.getId()));

        Totals totals = new Totals();
        BigDecimal billableAmount = BigDecimal.ZERO;
        BigDecimal unbilled = BigDecimal.ZERO;
        Map<UUID, Bucket> byResource = new LinkedHashMap<>();
        Map<UUID, Bucket> byTask = new LinkedHashMap<>();
        Map<LocalDate, Bucket> byWeek = new LinkedHashMap<>();
        for (TimeEntry entry : entries) {
            Timesheet sheet = sheets.get(entry.getTimesheetId());
            if (sheet == null) {
                continue;
            }
            String status = sheet.getStatus();
            totals.add(entry, status);
            if (Timesheet.STATUS_APPROVED.equals(status) && entry.isBillable() && entry.getBillingRate() != null) {
                billableAmount = billableAmount.add(entry.getHours().multiply(entry.getBillingRate()));
            }
            if (unbilledIds.contains(entry.getId())) {
                unbilled = unbilled.add(entry.getHours());
            }
            byResource.computeIfAbsent(sheet.getResourceId(), ignored -> new Bucket()).add(entry, status);
            if (entry.getTaskId() != null) {
                byTask.computeIfAbsent(entry.getTaskId(), ignored -> new Bucket()).add(entry, status);
            }
            byWeek.computeIfAbsent(sheet.getWeekStartDate(), ignored -> new Bucket()).add(entry, status);
        }

        Map<UUID, String> resourceLabels = resourceNames.byResourceIds(List.copyOf(byResource.keySet()));
        Map<UUID, String> taskLabels = new HashMap<>();
        for (ProjectTask task : projectTaskRepository.findByProjectId(projectId)) {
            taskLabels.put(task.getId(), task.getName());
        }
        List<TimeBucket> weeks = new ArrayList<>();
        byWeek.entrySet().stream()
                .sorted(Map.Entry.<LocalDate, Bucket>comparingByKey().reversed())
                .limit(12)
                .forEach(e -> weeks.add(e.getValue().toBucket(null, e.getKey().toString())));

        return new ProjectTimeSummary(
                projectId,
                project.getEstimatedHours(),
                totals.approved,
                totals.pending,
                totals.draft,
                totals.billable,
                totals.nonBillable,
                fieldAclEvaluator.canViewResourceRates() ? billableAmount : null,
                unbilled,
                buckets(byResource, id -> resourceLabels.getOrDefault(id, "Unknown resource")),
                buckets(byTask, id -> taskLabels.getOrDefault(id, "Deleted task")),
                weeks);
    }

    @Transactional(readOnly = true)
    public ResourceTimeSummary resourceSummary(UUID resourceId, LocalDate from, LocalDate to) {
        tenantAccess.requirePermission("RESOURCE_VIEW");
        Resource resource = resourceRepository
                .findActiveById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertRecordVisible(resource);

        LocalDate today = LocalDate.now();
        LocalDate start = from != null ? from : today.withDayOfMonth(1);
        LocalDate end = to != null ? to : start.withDayOfMonth(start.lengthOfMonth());
        if (end.isBefore(start) || ChronoUnit.DAYS.between(start, end) > MAX_PERIOD_DAYS) {
            throw new BusinessException("INVALID_PERIOD", "Choose a period of at most one year with from before to");
        }

        List<TimeEntry> entries = timeEntryRepository.findActiveByResourceBetween(resourceId, start, end);
        Map<UUID, Timesheet> sheets = sheetsFor(entries);
        Totals totals = new Totals();
        Map<UUID, Bucket> byProject = new LinkedHashMap<>();
        for (TimeEntry entry : entries) {
            Timesheet sheet = sheets.get(entry.getTimesheetId());
            if (sheet == null) {
                continue;
            }
            totals.add(entry, sheet.getStatus());
            byProject.computeIfAbsent(entry.getProjectId(), ignored -> new Bucket()).add(entry, sheet.getStatus());
        }

        Map<UUID, String> projectLabels = new HashMap<>();
        for (Project project : projectRepository.findAllById(byProject.keySet())) {
            projectLabels.put(project.getId(), project.getName());
        }

        BigDecimal capacity = capacityFor(resource, start, end);
        List<Timesheet> recent = timesheetRepository.findRecentByResourceId(resourceId, PageRequest.of(0, 8));
        Map<UUID, BigDecimal> recentTotals = new HashMap<>();
        if (!recent.isEmpty()) {
            for (TimeEntry entry : timeEntryRepository.findActiveByTimesheetIdIn(
                    recent.stream().map(Timesheet::getId).toList())) {
                recentTotals.merge(entry.getTimesheetId(), entry.getHours(), BigDecimal::add);
            }
        }

        return new ResourceTimeSummary(
                resourceId,
                start,
                end,
                capacity,
                totals.approved,
                totals.pending,
                totals.billableApproved,
                percent(totals.approved, capacity),
                percent(totals.billableApproved, capacity),
                buckets(byProject, id -> projectLabels.getOrDefault(id, "Deleted project")),
                recent.stream()
                        .map(sheet -> new TimesheetWeek(
                                sheet.getId(),
                                sheet.getWeekStartDate(),
                                sheet.getStatus(),
                                recentTotals.getOrDefault(sheet.getId(), BigDecimal.ZERO)))
                        .toList());
    }

    private Map<UUID, Timesheet> sheetsFor(List<TimeEntry> entries) {
        Set<UUID> ids = new HashSet<>();
        entries.forEach(entry -> ids.add(entry.getTimesheetId()));
        Map<UUID, Timesheet> sheets = new HashMap<>();
        for (Timesheet sheet : timesheetRepository.findAllById(ids)) {
            if (sheet.getDeletedAt() == null) {
                sheets.put(sheet.getId(), sheet);
            }
        }
        return sheets;
    }

    /** Weekly capacity spread over weekdays (Mon–Fri) in the period. */
    private static BigDecimal capacityFor(Resource resource, LocalDate start, LocalDate end) {
        BigDecimal weekly = resource.getCapacityHoursPerWeek();
        if (weekly == null) {
            return null;
        }
        long weekdays = 0;
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            if (day.getDayOfWeek() != DayOfWeek.SATURDAY && day.getDayOfWeek() != DayOfWeek.SUNDAY) {
                weekdays++;
            }
        }
        return weekly.multiply(BigDecimal.valueOf(weekdays)).divide(BigDecimal.valueOf(5), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal percent(BigDecimal hours, BigDecimal capacity) {
        if (capacity == null || capacity.signum() == 0) {
            return null;
        }
        return hours.multiply(BigDecimal.valueOf(100)).divide(capacity, 1, RoundingMode.HALF_UP);
    }

    private static List<TimeBucket> buckets(Map<UUID, Bucket> source, Function<UUID, String> label) {
        return source.entrySet().stream()
                .map(e -> e.getValue().toBucket(e.getKey(), label.apply(e.getKey())))
                .sorted(Comparator.comparing(TimeBucket::approvedHours).reversed())
                .toList();
    }

    private static final class Totals {
        private BigDecimal approved = BigDecimal.ZERO;
        private BigDecimal pending = BigDecimal.ZERO;
        private BigDecimal draft = BigDecimal.ZERO;
        private BigDecimal billable = BigDecimal.ZERO;
        private BigDecimal nonBillable = BigDecimal.ZERO;
        private BigDecimal billableApproved = BigDecimal.ZERO;

        void add(TimeEntry entry, String status) {
            BigDecimal hours = entry.getHours();
            switch (status) {
                case Timesheet.STATUS_APPROVED -> approved = approved.add(hours);
                case Timesheet.STATUS_SUBMITTED -> pending = pending.add(hours);
                default -> draft = draft.add(hours);
            }
            if (entry.isBillable()) {
                billable = billable.add(hours);
                if (Timesheet.STATUS_APPROVED.equals(status)) {
                    billableApproved = billableApproved.add(hours);
                }
            } else {
                nonBillable = nonBillable.add(hours);
            }
        }
    }

    private static final class Bucket {
        private BigDecimal approved = BigDecimal.ZERO;
        private BigDecimal pending = BigDecimal.ZERO;
        private BigDecimal billable = BigDecimal.ZERO;

        void add(TimeEntry entry, String status) {
            if (Timesheet.STATUS_APPROVED.equals(status)) {
                approved = approved.add(entry.getHours());
            } else if (Timesheet.STATUS_SUBMITTED.equals(status)) {
                pending = pending.add(entry.getHours());
            }
            if (entry.isBillable()) {
                billable = billable.add(entry.getHours());
            }
        }

        TimeBucket toBucket(UUID id, String label) {
            return new TimeBucket(id, label, approved, pending, billable);
        }
    }
}
