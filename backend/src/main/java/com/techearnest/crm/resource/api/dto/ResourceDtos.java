package com.techearnest.crm.resource.api.dto;

import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocation;
import com.techearnest.crm.resource.domain.ResourceSkill;
import com.techearnest.crm.resource.domain.Skill;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ResourceDtos {

    private ResourceDtos() {}

    public record ResourceResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID userId,
            String employeeCode,
            String designation,
            UUID departmentId,
            UUID managerId,
            String resourceType,
            LocalDate joiningDate,
            BigDecimal costRate,
            BigDecimal billingRate,
            BigDecimal capacityHoursPerWeek,
            String status,
            Instant createdAt,
            Instant updatedAt) {

        public static ResourceResponse from(Resource resource, boolean includeRates) {
            return new ResourceResponse(
                    resource.getId(),
                    resource.getOrganizationId(),
                    resource.getRegionId(),
                    resource.getUserId(),
                    resource.getEmployeeCode(),
                    resource.getDesignation(),
                    resource.getDepartmentId(),
                    resource.getManagerId(),
                    resource.getResourceType(),
                    resource.getJoiningDate(),
                    includeRates ? resource.getCostRate() : null,
                    includeRates ? resource.getBillingRate() : null,
                    resource.getCapacityHoursPerWeek(),
                    resource.getStatus(),
                    resource.getCreatedAt(),
                    resource.getUpdatedAt());
        }
    }

    public record CreateResourceRequest(
            UUID organizationId,
            @NotNull UUID regionId,
            UUID userId,
            @Size(max = 64) String employeeCode,
            @Size(max = 128) String designation,
            UUID departmentId,
            UUID managerId,
            @NotBlank @Size(max = 32) String resourceType,
            LocalDate joiningDate,
            BigDecimal costRate,
            BigDecimal billingRate,
            BigDecimal capacityHoursPerWeek,
            @Size(max = 32) String status) {}

    public record UpdateResourceRequest(
            UUID regionId,
            UUID userId,
            @Size(max = 64) String employeeCode,
            @Size(max = 128) String designation,
            UUID departmentId,
            UUID managerId,
            @Size(max = 32) String resourceType,
            LocalDate joiningDate,
            BigDecimal costRate,
            BigDecimal billingRate,
            BigDecimal capacityHoursPerWeek,
            @Size(max = 32) String status) {}

    public record SkillResponse(
            UUID id, UUID organizationId, String name, String category, Instant createdAt, Instant updatedAt) {

        public static SkillResponse from(Skill skill) {
            return new SkillResponse(
                    skill.getId(),
                    skill.getOrganizationId(),
                    skill.getName(),
                    skill.getCategory(),
                    skill.getCreatedAt(),
                    skill.getUpdatedAt());
        }
    }

    public record CreateSkillRequest(
            UUID organizationId, @NotBlank @Size(max = 128) String name, @Size(max = 64) String category) {}

    public record UpdateSkillRequest(@Size(max = 128) String name, @Size(max = 64) String category) {}

    public record ResourceSkillItem(
            @NotNull UUID skillId,
            @NotBlank @Size(max = 32) String proficiency,
            BigDecimal yearsOfExperience) {}

    public record ReplaceSkillsRequest(@NotNull @Valid List<ResourceSkillItem> skills) {}

    public record ResourceSkillResponse(
            UUID skillId, String proficiency, BigDecimal yearsOfExperience) {

        public static ResourceSkillResponse from(ResourceSkill skill) {
            return new ResourceSkillResponse(
                    skill.getSkillId(), skill.getProficiency(), skill.getYearsOfExperience());
        }
    }

    public record AllocationResponse(
            UUID id,
            UUID organizationId,
            UUID projectId,
            UUID resourceId,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal allocatedHours,
            BigDecimal allocationPercentage,
            String role,
            BigDecimal billingRate,
            BigDecimal costRate,
            String status,
            String warning,
            Instant createdAt,
            Instant updatedAt) {

        public static AllocationResponse from(ResourceAllocation allocation, boolean includeRates, String warning) {
            return new AllocationResponse(
                    allocation.getId(),
                    allocation.getOrganizationId(),
                    allocation.getProjectId(),
                    allocation.getResourceId(),
                    allocation.getStartDate(),
                    allocation.getEndDate(),
                    allocation.getAllocatedHours(),
                    allocation.getAllocationPercentage(),
                    allocation.getRole(),
                    includeRates ? allocation.getBillingRate() : null,
                    includeRates ? allocation.getCostRate() : null,
                    allocation.getStatus(),
                    warning,
                    allocation.getCreatedAt(),
                    allocation.getUpdatedAt());
        }
    }

    public record CreateAllocationRequest(
            UUID organizationId,
            @NotNull UUID projectId,
            @NotNull UUID resourceId,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            BigDecimal allocatedHours,
            BigDecimal allocationPercentage,
            @Size(max = 128) String role,
            BigDecimal billingRate,
            BigDecimal costRate,
            @Size(max = 32) String status,
            Boolean dryRun) {}

    public record UpdateAllocationRequest(
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal allocatedHours,
            BigDecimal allocationPercentage,
            @Size(max = 128) String role,
            BigDecimal billingRate,
            BigDecimal costRate,
            @Size(max = 32) String status,
            Boolean dryRun) {}

    public record UtilizationResponse(
            UUID resourceId,
            LocalDate periodStart,
            LocalDate periodEnd,
            BigDecimal capacityHours,
            BigDecimal allocatedHours,
            BigDecimal availableHours,
            BigDecimal utilizationPercent,
            boolean overAllocated,
            String warning) {}
}
