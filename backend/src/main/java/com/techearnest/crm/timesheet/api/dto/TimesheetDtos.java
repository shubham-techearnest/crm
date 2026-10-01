package com.techearnest.crm.timesheet.api.dto;

import com.techearnest.crm.timesheet.domain.TimeEntry;
import com.techearnest.crm.timesheet.domain.Timesheet;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class TimesheetDtos {

    private TimesheetDtos() {}

    public record TimesheetResponse(
            UUID id,
            UUID organizationId,
            UUID resourceId,
            UUID regionId,
            LocalDate weekStartDate,
            String status,
            Instant submittedAt,
            Instant approvedAt,
            UUID approvedBy,
            String rejectionReason,
            BigDecimal totalHours,
            String warning,
            List<TimeEntryResponse> entries,
            Instant createdAt,
            Instant updatedAt,
            String entrySource,
            UUID enteredBy,
            String resourceName,
            String notes,
            String visibility) {

        /** The viewer sees every entry. */
        public static final String VISIBILITY_ALL = "ALL";
        /** The viewer is a project manager and sees only the entries of projects they manage. */
        public static final String VISIBILITY_MY_PROJECTS = "MY_PROJECTS";

        public static TimesheetResponse from(
                Timesheet timesheet, List<TimeEntry> entries, String warning, boolean includeRates) {
            BigDecimal total = entries.stream()
                    .map(TimeEntry::getHours)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            return new TimesheetResponse(
                    timesheet.getId(),
                    timesheet.getOrganizationId(),
                    timesheet.getResourceId(),
                    timesheet.getRegionId(),
                    timesheet.getWeekStartDate(),
                    timesheet.getStatus(),
                    timesheet.getSubmittedAt(),
                    timesheet.getApprovedAt(),
                    timesheet.getApprovedBy(),
                    timesheet.getRejectionReason(),
                    total,
                    warning,
                    entries.stream().map(e -> TimeEntryResponse.from(e, includeRates)).toList(),
                    timesheet.getCreatedAt(),
                    timesheet.getUpdatedAt(),
                    timesheet.getEntrySource(),
                    timesheet.getEnteredBy(),
                    null,
                    timesheet.getNotes(),
                    VISIBILITY_ALL);
        }

        public static TimesheetResponse from(
                Timesheet timesheet, List<TimeEntry> entries, String warning) {
            return from(timesheet, entries, warning, true);
        }

        public static TimesheetResponse summary(Timesheet timesheet, BigDecimal totalHours) {
            return new TimesheetResponse(
                    timesheet.getId(),
                    timesheet.getOrganizationId(),
                    timesheet.getResourceId(),
                    timesheet.getRegionId(),
                    timesheet.getWeekStartDate(),
                    timesheet.getStatus(),
                    timesheet.getSubmittedAt(),
                    timesheet.getApprovedAt(),
                    timesheet.getApprovedBy(),
                    timesheet.getRejectionReason(),
                    totalHours,
                    null,
                    List.of(),
                    timesheet.getCreatedAt(),
                    timesheet.getUpdatedAt(),
                    timesheet.getEntrySource(),
                    timesheet.getEnteredBy(),
                    null,
                    timesheet.getNotes(),
                    VISIBILITY_ALL);
        }

        public TimesheetResponse withResourceName(String name) {
            return new TimesheetResponse(
                    id, organizationId, resourceId, regionId, weekStartDate, status, submittedAt, approvedAt,
                    approvedBy, rejectionReason, totalHours, warning, entries, createdAt, updatedAt, entrySource,
                    enteredBy, name, notes, visibility);
        }

        public TimesheetResponse withVisibility(String value) {
            return new TimesheetResponse(
                    id, organizationId, resourceId, regionId, weekStartDate, status, submittedAt, approvedAt,
                    approvedBy, rejectionReason, totalHours, warning, entries, createdAt, updatedAt, entrySource,
                    enteredBy, resourceName, notes, value);
        }
    }

    public record TimeEntryResponse(
            UUID id,
            UUID timesheetId,
            UUID projectId,
            UUID taskId,
            LocalDate workDate,
            BigDecimal hours,
            String description,
            boolean billable,
            BigDecimal billingRate,
            Instant createdAt,
            Instant updatedAt,
            UUID approvedBy,
            Instant approvedAt) {

        public static TimeEntryResponse from(TimeEntry entry, boolean includeRates) {
            return new TimeEntryResponse(
                    entry.getId(),
                    entry.getTimesheetId(),
                    entry.getProjectId(),
                    entry.getTaskId(),
                    entry.getWorkDate(),
                    entry.getHours(),
                    entry.getDescription(),
                    entry.isBillable(),
                    includeRates ? entry.getBillingRate() : null,
                    entry.getCreatedAt(),
                    entry.getUpdatedAt(),
                    entry.getApprovedBy(),
                    entry.getApprovedAt());
        }

        public static TimeEntryResponse from(TimeEntry entry) {
            return from(entry, true);
        }
    }

    public static final String START_BLANK = "BLANK";
    public static final String START_COPY_PREVIOUS = "COPY_PREVIOUS";
    public static final String START_QUICK_FILL = "QUICK_FILL";
    public static final String START_CUSTOM = "CUSTOM";

    /**
     * {@code startWith} is BLANK (default), COPY_PREVIOUS (last week's entries), QUICK_FILL (the same hours on
     * the chosen days for one project, from {@code quickFill}) or CUSTOM (the day-by-day {@code entries} filled in
     * on the create form).
     */
    public record CreateTimesheetRequest(
            UUID organizationId,
            UUID resourceId,
            @NotNull LocalDate weekStartDate,
            @Size(max = 2000) String notes,
            @Pattern(regexp = "BLANK|COPY_PREVIOUS|QUICK_FILL|CUSTOM") String startWith,
            @Valid QuickFillRequest quickFill,
            Boolean submitAfterCreate,
            @Size(max = 200) List<@Valid LinkEntryRequest> entries) {

        public CreateTimesheetRequest(UUID organizationId, UUID resourceId, LocalDate weekStartDate) {
            this(organizationId, resourceId, weekStartDate, null, null, null, null, null);
        }
    }

    /** {@code days} are ISO days of the week: 1 = Monday … 7 = Sunday. */
    public record QuickFillRequest(
            @NotNull UUID projectId,
            UUID taskId,
            @NotNull @DecimalMin("0.25") @DecimalMax("24.00") BigDecimal hoursPerDay,
            @NotNull @Size(min = 1, max = 7) List<@NotNull @Min(1) @Max(7) Integer> days,
            Boolean billable,
            @Size(max = 500) String description) {}

    public record UpdateTimesheetRequest(Long version, @Size(max = 2000) String notes) {}

    public record CreateTimeEntryRequest(
            @NotNull UUID projectId,
            UUID taskId,
            @NotNull LocalDate workDate,
            @NotNull @DecimalMin("0.01") @DecimalMax("24.00") BigDecimal hours,
            @Size(max = 500) String description,
            Boolean billable,
            BigDecimal billingRate) {}

    public record UpdateTimeEntryRequest(
            UUID projectId,
            UUID taskId,
            LocalDate workDate,
            @DecimalMin("0.01") @DecimalMax("24.00") BigDecimal hours,
            @Size(max = 500) String description,
            Boolean billable,
            BigDecimal billingRate,
            Boolean clearTask) {}

    public record RejectTimesheetRequest(@NotBlank @Size(max = 2000) String reason) {}

    /** Full set of entries for a weekly grid save; replaces the timesheet's current entries. */
    public record SaveEntriesRequest(@NotNull @Size(max = 200) List<@Valid LinkEntryRequest> entries) {}

    public record BulkApproveRequest(@NotNull @Size(min = 1, max = 100) List<@NotNull UUID> ids) {}

    public record BulkRejectRequest(
            @NotNull @Size(min = 1, max = 100) List<@NotNull UUID> ids, @NotBlank @Size(max = 2000) String reason) {}

    public record BulkActionResult(UUID id, boolean success, String message) {}

    public record ProjectTimeSummary(
            UUID projectId,
            BigDecimal estimatedHours,
            BigDecimal approvedHours,
            BigDecimal pendingHours,
            BigDecimal draftHours,
            BigDecimal billableHours,
            BigDecimal nonBillableHours,
            BigDecimal billableAmount,
            BigDecimal unbilledHours,
            List<TimeBucket> byResource,
            List<TimeBucket> byTask,
            List<TimeBucket> byWeek) {}

    /** Hours for one resource, task or week; {@code label} is a display name or ISO week start. */
    public record TimeBucket(UUID id, String label, BigDecimal approvedHours, BigDecimal pendingHours, BigDecimal billableHours) {}

    public record ResourceTimeSummary(
            UUID resourceId,
            LocalDate periodStart,
            LocalDate periodEnd,
            BigDecimal capacityHours,
            BigDecimal approvedHours,
            BigDecimal pendingHours,
            BigDecimal billableHours,
            BigDecimal actualUtilizationPercent,
            BigDecimal billableUtilizationPercent,
            List<TimeBucket> byProject,
            List<TimesheetWeek> recentWeeks) {}

    public record TimesheetWeek(UUID timesheetId, LocalDate weekStartDate, String status, BigDecimal totalHours) {}

    /** A project the timesheet's resource is allocated to, with its open tasks, for the entry picker. */
    /** {@code closed} projects (completed or cancelled) are listed for display only; no new time can be logged. */
    public record EntryProjectOption(
            UUID projectId, String name, String projectCode, String status, boolean closed, List<EntryTaskOption> tasks) {}

    public record EntryTaskOption(UUID taskId, String name, String status) {}

    // —— Secure timesheet links (no login) ——

    public record IssueTimesheetLinkRequest(@NotNull LocalDate weekStartDate, Boolean sendEmail) {}

    public record TimesheetLinkIssued(String url, Instant expiresAt, LocalDate weekStartDate, boolean emailed, String email) {}

    public record LinkEntryRequest(
            @NotNull UUID projectId,
            UUID taskId,
            @NotNull LocalDate workDate,
            @NotNull @DecimalMin("0.01") @DecimalMax("24.00") BigDecimal hours,
            @Size(max = 500) String description,
            Boolean billable) {}

    public record LinkSubmitRequest(@NotNull @Size(min = 1, max = 100) List<@Valid LinkEntryRequest> entries) {}

    public record LinkEntryView(
            UUID projectId, UUID taskId, LocalDate workDate, BigDecimal hours, String description, boolean billable) {}

    public record TimesheetLinkView(
            String resourceName,
            String organizationName,
            LocalDate weekStartDate,
            LocalDate weekEndDate,
            String status,
            String rejectionReason,
            boolean editable,
            Instant expiresAt,
            BigDecimal capacityHoursPerWeek,
            List<EntryProjectOption> projects,
            List<LinkEntryView> entries) {}
}
