package com.techearnest.crm.resource.api.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Read models for the resource board. Money fields are null when the caller may not see rates;
 * {@code financialsVisible} tells the client which case applies.
 */
public final class ResourceBoardDtos {

    private ResourceBoardDtos() {}

    /** Board filters; every field is optional. */
    public record BoardFilter(
            String search,
            List<String> resourceTypes,
            String category,
            UUID departmentId,
            UUID regionId,
            UUID projectId,
            List<UUID> skillIds,
            BigDecimal minExperienceYears,
            Integer availableWithinDays,
            BigDecimal maxAllocationPct,
            List<String> statuses,
            String location,
            Boolean billable,
            boolean includeInactive) {

        public static BoardFilter none() {
            return new BoardFilter(null, null, null, null, null, null, null, null, null, null, null, null, null, false);
        }
    }

    public record BoardSettingsResponse(
            int endingSoonDays,
            BigDecimal benchMaxAllocationPct,
            BigDecimal fullAllocationPct,
            BigDecimal overallocationPct,
            int forecastWeeks,
            Instant updatedAt) {}

    public record UpdateBoardSettingsRequest(
            @Min(1) @Max(180) Integer endingSoonDays,
            @DecimalMin("0") @DecimalMax("99") BigDecimal benchMaxAllocationPct,
            @DecimalMin("1") @DecimalMax("200") BigDecimal fullAllocationPct,
            @DecimalMin("1") @DecimalMax("300") BigDecimal overallocationPct,
            @Min(1) @Max(52) Integer forecastWeeks) {}

    public record BoardSkill(UUID skillId, String name, String proficiency, BigDecimal yearsOfExperience, boolean primary) {}

    public record BoardAllocation(
            UUID allocationId,
            UUID projectId,
            String projectName,
            String projectCode,
            String projectStatus,
            LocalDate projectEndDate,
            String role,
            BigDecimal allocationPct,
            BigDecimal hoursPerWeek,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            String phase,
            boolean billable,
            BigDecimal costRate,
            BigDecimal billingRate) {}

    public record BoardResource(
            UUID id,
            String name,
            String code,
            String resourceType,
            String category,
            String designation,
            UUID departmentId,
            String departmentName,
            String managerName,
            UUID regionId,
            String location,
            String status,
            String storedStatus,
            String band,
            BigDecimal currentAllocationPct,
            BigDecimal futureAllocationPct,
            boolean available,
            LocalDate availableFrom,
            BigDecimal availableCapacityPct,
            boolean endingSoon,
            LocalDate currentAllocationEndsOn,
            LocalDate nextAllocationStartsOn,
            LocalDate engagementStartDate,
            LocalDate engagementEndDate,
            boolean engagementEndingSoon,
            boolean onLeave,
            BigDecimal experienceYears,
            boolean billable,
            int activeProjectCount,
            BigDecimal capacityHours,
            BigDecimal allocatedHours,
            BigDecimal availableHours,
            BigDecimal utilizationPct,
            BigDecimal actualHours,
            BigDecimal billableHours,
            BigDecimal pendingHours,
            BigDecimal cost,
            BigDecimal revenue,
            BigDecimal margin,
            BigDecimal marginPct,
            BigDecimal costRate,
            BigDecimal billingRate,
            String rateUnit,
            List<BoardSkill> skills,
            List<BoardAllocation> allocations,
            List<BigDecimal> weeklyLoad) {}

    public record BoardProject(
            UUID projectId,
            String name,
            String projectCode,
            String status,
            String billingType,
            LocalDate endDate,
            String managerName,
            int teamSize,
            BigDecimal fte,
            BigDecimal allocatedHours,
            BigDecimal actualHours,
            BigDecimal billableHours,
            BigDecimal cost,
            BigDecimal revenue,
            BigDecimal profit,
            BigDecimal marginPct,
            int membersEndingSoon,
            int membersOverallocated,
            String staffingSignal) {}

    public record SkillSupply(
            UUID skillId, String name, String category, int resources, int available, int primary) {}

    /** Capacity and utilization for a group of resources (organization, department, type). */
    public record GroupMetrics(
            String key,
            String label,
            int resources,
            BigDecimal capacityHours,
            BigDecimal allocatedHours,
            BigDecimal availableHours,
            BigDecimal utilizationPct,
            BigDecimal actualHours,
            BigDecimal billableHours,
            BigDecimal nonBillableHours,
            BigDecimal billableUtilizationPct,
            BigDecimal cost,
            BigDecimal revenue,
            BigDecimal margin,
            BigDecimal marginPct) {}

    public record BoardSummary(
            int totalResources,
            int employees,
            int externals,
            int available,
            int bench,
            int partiallyAllocated,
            int fullyAllocated,
            int overallocated,
            int endingSoon,
            int onLeave,
            int inactive,
            Map<String, Integer> byType,
            Map<String, Integer> byStatus,
            GroupMetrics totals) {}

    public record ResourceBoardResponse(
            LocalDate asOf,
            LocalDate periodStart,
            LocalDate periodEnd,
            boolean financialsVisible,
            BoardSettingsResponse settings,
            List<LocalDate> weeks,
            BoardSummary summary,
            List<BoardResource> resources,
            List<BoardProject> projects,
            List<SkillSupply> skills,
            List<GroupMetrics> byDepartment,
            List<GroupMetrics> byType) {}

    public record CapacityResponse(
            LocalDate periodStart,
            LocalDate periodEnd,
            boolean financialsVisible,
            GroupMetrics organization,
            List<GroupMetrics> byDepartment,
            List<GroupMetrics> byType,
            List<BoardProject> byProject) {}

    public record WorkloadTask(
            UUID id,
            UUID projectId,
            String projectName,
            String name,
            String status,
            String priority,
            LocalDate dueDate,
            BigDecimal estimatedHours,
            BigDecimal actualHours) {}

    public record WorkloadTimesheet(UUID id, LocalDate weekStartDate, String status, BigDecimal hours, BigDecimal billableHours) {}

    public record WorkloadProjectCost(
            UUID projectId,
            String projectName,
            BigDecimal hours,
            BigDecimal billableHours,
            BigDecimal cost,
            BigDecimal revenue,
            BigDecimal margin,
            BigDecimal marginPct) {}

    public record ResourceWorkloadResponse(
            boolean financialsVisible,
            BoardResource resource,
            List<BoardAllocation> allocations,
            List<WorkloadTask> tasks,
            List<WorkloadTimesheet> timesheets,
            List<WorkloadProjectCost> costs,
            List<ResourceDtos.UnavailabilityResponse> leave,
            List<LocalDate> weeks) {}
}
