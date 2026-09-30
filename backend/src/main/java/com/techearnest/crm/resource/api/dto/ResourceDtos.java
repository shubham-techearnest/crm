package com.techearnest.crm.resource.api.dto;

import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceAllocation;
import com.techearnest.crm.resource.domain.ResourceSkill;
import com.techearnest.crm.resource.domain.Skill;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ResourceDtos {

    private ResourceDtos() {}

    public record ResourceResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID userId,
            String employeeName,
            String employeeCode,
            String designation,
            UUID departmentId,
            String departmentName,
            UUID managerId,
            String managerName,
            String resourceType,
            LocalDate joiningDate,
            BigDecimal costRate,
            BigDecimal billingRate,
            BigDecimal capacityHoursPerWeek,
            String status,
            Instant createdAt,
            Instant updatedAt,
            String fullName,
            String email,
            String phone,
            LocalDate engagementEndDate,
            String loginStatus,
            Instant accessExpiresAt) {

        public static ResourceResponse from(Resource resource, boolean includeCostRate, boolean includeBillingRate) {
            return from(resource, includeCostRate, includeBillingRate, ResourceNames.NONE);
        }

        public static ResourceResponse from(
                Resource resource, boolean includeCostRate, boolean includeBillingRate, ResourceNames names) {
            String userName = names.user(resource.getUserId());
            LoginInfo login = names.login(resource.getUserId());
            return new ResourceResponse(
                    resource.getId(),
                    resource.getOrganizationId(),
                    resource.getRegionId(),
                    resource.getUserId(),
                    userName != null ? userName : resource.getFullName(),
                    resource.getEmployeeCode(),
                    resource.getDesignation(),
                    resource.getDepartmentId(),
                    names.department(resource.getDepartmentId()),
                    resource.getManagerId(),
                    names.user(resource.getManagerId()),
                    resource.getResourceType(),
                    resource.getJoiningDate(),
                    includeCostRate ? resource.getCostRate() : null,
                    includeBillingRate ? resource.getBillingRate() : null,
                    resource.getCapacityHoursPerWeek(),
                    resource.getStatus(),
                    resource.getCreatedAt(),
                    resource.getUpdatedAt(),
                    resource.getFullName(),
                    resource.getEmail(),
                    resource.getPhone(),
                    resource.getEngagementEndDate(),
                    resource.getUserId() == null ? "NONE" : login != null ? login.status() : null,
                    login != null ? login.accessExpiresAt() : null);
        }
    }

    public record LoginInfo(String status, Instant accessExpiresAt) {}

    /** Display names for the users and departments a resource points to, plus login state of linked users. */
    public record ResourceNames(
            Map<UUID, String> users, Map<UUID, String> departments, Map<UUID, LoginInfo> logins) {

        public static final ResourceNames NONE = new ResourceNames(Map.of(), Map.of(), Map.of());

        String user(UUID id) {
            return id == null ? null : users.get(id);
        }

        String department(UUID id) {
            return id == null ? null : departments.get(id);
        }

        LoginInfo login(UUID userId) {
            return userId == null ? null : logins.get(userId);
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
            @Size(max = 32) String status,
            @Size(max = 200) String fullName,
            @Email @Size(max = 255) String email,
            @Size(max = 50) String phone,
            LocalDate engagementEndDate) {

        public CreateResourceRequest(
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
                String status) {
            this(organizationId, regionId, userId, employeeCode, designation, departmentId, managerId, resourceType,
                    joiningDate, costRate, billingRate, capacityHoursPerWeek, status, null, null, null, null);
        }
    }

    /**
     * Creates a resource and, in the same transaction, allocates it to a project and grants its default access
     * (a portal login for external resources; employees already sign in with their user account).
     * Allocation dates default to today .. the project's end date (or the engagement end date).
     */
    public record OnboardResourceRequest(
            @NotNull @Valid CreateResourceRequest resource,
            UUID projectId,
            LocalDate allocationStartDate,
            LocalDate allocationEndDate,
            @DecimalMin("0") @DecimalMax("100") BigDecimal allocationPercentage,
            @Size(max = 128) String allocationRole,
            Boolean grantPortalAccess) {}

    public record OnboardResourceResponse(
            ResourceResponse resource,
            AllocationResponse allocation,
            com.techearnest.crm.resource.api.dto.ResourcePortalDtos.PortalAccessResponse portalAccess,
            List<String> warnings) {}

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
            @Size(max = 32) String status,
            @Size(max = 200) String fullName,
            @Email @Size(max = 255) String email,
            @Size(max = 50) String phone,
            LocalDate engagementEndDate,
            Boolean clearEngagementEndDate) {}

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

        public static AllocationResponse from(
                ResourceAllocation allocation,
                boolean includeBillingRate,
                boolean includeCostRate,
                String warning) {
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
                    includeBillingRate ? allocation.getBillingRate() : null,
                    includeCostRate ? allocation.getCostRate() : null,
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
