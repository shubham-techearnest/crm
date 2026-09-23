package com.techearnest.crm.timesheet.api.dto;

import com.techearnest.crm.timesheet.domain.TimeEntry;
import com.techearnest.crm.timesheet.domain.Timesheet;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
            Instant updatedAt) {

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
                    timesheet.getUpdatedAt());
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
                    timesheet.getUpdatedAt());
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
            Instant updatedAt) {

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
                    entry.getUpdatedAt());
        }

        public static TimeEntryResponse from(TimeEntry entry) {
            return from(entry, true);
        }
    }

    public record CreateTimesheetRequest(UUID organizationId, UUID resourceId, @NotNull LocalDate weekStartDate) {}

    public record UpdateTimesheetRequest(Long version) {}

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
}
