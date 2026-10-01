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
            Instant accessExpiresAt,
            String typeCategory,
            LocalDate engagementStartDate,
            String contractReference,
            UUID vendorId,
            String vendorName,
            BigDecimal workingHoursPerDay,
            BigDecimal workingDaysPerWeek,
            BigDecimal experienceYears,
            String location,
            LocalDate availableFrom,
            boolean billable,
            String rateUnit,
            Instant deactivatedAt,
            String deactivationReason) {

        public static ResourceResponse from(Resource resource, boolean includeCostRate, boolean includeBillingRate) {
            return from(resource, includeCostRate, includeBillingRate, ResourceNames.NONE);
        }

        public static ResourceResponse from(
                Resource resource, boolean includeCostRate, boolean includeBillingRate, ResourceNames names) {
            String userName = names.user(resource.getUserId());
            LoginInfo login = names.login(resource.getUserId());
            String category = names.typeCategory(resource.getResourceType());
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
                    login != null ? login.accessExpiresAt() : null,
                    category != null ? category : resource.isExternal() ? "EXTERNAL" : "INTERNAL",
                    resource.getEngagementStartDate(),
                    resource.getContractReference(),
                    resource.getVendorId(),
                    names.vendor(resource.getVendorId()),
                    resource.getWorkingHoursPerDay(),
                    resource.getWorkingDaysPerWeek(),
                    resource.getExperienceYears(),
                    resource.getLocation(),
                    resource.getAvailableFrom(),
                    resource.isBillable(),
                    resource.getRateUnit(),
                    resource.getDeactivatedAt(),
                    resource.getDeactivationReason());
        }
    }

    public record LoginInfo(String status, Instant accessExpiresAt) {}

    /** Display names for the users, departments and vendors a resource points to, plus login state of linked users. */
    public record ResourceNames(
            Map<UUID, String> users,
            Map<UUID, String> departments,
            Map<UUID, LoginInfo> logins,
            Map<UUID, String> vendors,
            Map<String, String> typeCategories) {

        public static final ResourceNames NONE = new ResourceNames(Map.of(), Map.of(), Map.of(), Map.of(), Map.of());

        public ResourceNames(Map<UUID, String> users, Map<UUID, String> departments, Map<UUID, LoginInfo> logins) {
            this(users, departments, logins, Map.of(), Map.of());
        }

        String user(UUID id) {
            return id == null ? null : users.get(id);
        }

        String department(UUID id) {
            return id == null ? null : departments.get(id);
        }

        LoginInfo login(UUID userId) {
            return userId == null ? null : logins.get(userId);
        }

        String vendor(UUID id) {
            return id == null ? null : vendors.get(id);
        }

        String typeCategory(String type) {
            return type == null ? null : typeCategories.get(type);
        }
    }

    public record ResourceTypeResponse(
            String code, String name, String category, String codePrefix, boolean requiresUser, boolean active) {

        public static ResourceTypeResponse from(com.techearnest.crm.resource.domain.ResourceType type) {
            return new ResourceTypeResponse(
                    type.getCode(), type.getName(), type.getCategory(), type.getCodePrefix(),
                    type.isRequiresUser(), type.isActive());
        }
    }

    /** Profile, capacity and engagement fields shared by create and update. Null leaves a value unchanged. */
    public record ResourceProfile(
            LocalDate engagementStartDate,
            @Size(max = 128) String contractReference,
            UUID vendorId,
            @DecimalMin(value = "0.5") @DecimalMax("24") BigDecimal workingHoursPerDay,
            @DecimalMin(value = "0.5") @DecimalMax("7") BigDecimal workingDaysPerWeek,
            @DecimalMin("0") @DecimalMax("60") BigDecimal experienceYears,
            @Size(max = 128) String location,
            LocalDate availableFrom,
            Boolean billable,
            @Size(max = 16) String rateUnit,
            Boolean clearVendor,
            Boolean clearAvailableFrom,
            Boolean clearEngagementStartDate) {}

    public record DeactivateResourceRequest(
            @Size(max = 32) String status,
            @Size(max = 500) String reason,
            LocalDate effectiveDate,
            Boolean endOpenAllocations,
            Boolean revokePortalAccess) {}

    public record ReactivateResourceRequest(
            LocalDate engagementStartDate, LocalDate engagementEndDate, LocalDate availableFrom) {}

    public record ResourceLifecycleResponse(
            ResourceResponse resource, int allocationsEnded, int allocationsCancelled, boolean portalAccessRevoked) {}

    public record UnavailabilityRequest(
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            @Size(max = 16) String kind,
            @DecimalMin(value = "0.5") @DecimalMax("24") BigDecimal hoursPerDay,
            @Size(max = 500) String reason) {}

    public record UnavailabilityResponse(
            UUID id,
            UUID resourceId,
            LocalDate startDate,
            LocalDate endDate,
            String kind,
            BigDecimal hoursPerDay,
            String reason,
            Instant createdAt) {

        public static UnavailabilityResponse from(com.techearnest.crm.resource.domain.ResourceUnavailability value) {
            return new UnavailabilityResponse(
                    value.getId(), value.getResourceId(), value.getStartDate(), value.getEndDate(),
                    value.getKind(), value.getHoursPerDay(), value.getReason(), value.getCreatedAt());
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
            LocalDate engagementEndDate,
            @Valid ResourceProfile profile) {

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
                String status,
                String fullName,
                String email,
                String phone,
                LocalDate engagementEndDate) {
            this(organizationId, regionId, userId, employeeCode, designation, departmentId, managerId, resourceType,
                    joiningDate, costRate, billingRate, capacityHoursPerWeek, status, fullName, email, phone,
                    engagementEndDate, null);
        }

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
                    joiningDate, costRate, billingRate, capacityHoursPerWeek, status, null, null, null, null, null);
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
            Boolean clearEngagementEndDate,
            @Valid ResourceProfile profile) {}

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
            @DecimalMin("0") @DecimalMax("60") BigDecimal yearsOfExperience,
            Boolean primary,
            @Size(max = 200) String certification) {

        public ResourceSkillItem(UUID skillId, String proficiency, BigDecimal yearsOfExperience) {
            this(skillId, proficiency, yearsOfExperience, null, null);
        }
    }

    public record ReplaceSkillsRequest(@NotNull @Valid List<ResourceSkillItem> skills) {}

    public record ResourceSkillResponse(
            UUID skillId, String proficiency, BigDecimal yearsOfExperience, boolean primary, String certification) {

        public static ResourceSkillResponse from(ResourceSkill skill) {
            return new ResourceSkillResponse(
                    skill.getSkillId(), skill.getProficiency(), skill.getYearsOfExperience(),
                    skill.isPrimary(), skill.getCertification());
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
            Instant updatedAt,
            boolean billable,
            String source,
            String notes,
            UUID milestoneId,
            Instant endedAt,
            List<String> warnings) {

        public static AllocationResponse from(
                ResourceAllocation allocation,
                boolean includeBillingRate,
                boolean includeCostRate,
                String warning) {
            return from(allocation, includeBillingRate, includeCostRate, warning, List.of());
        }

        public static AllocationResponse from(
                ResourceAllocation allocation,
                boolean includeBillingRate,
                boolean includeCostRate,
                String warning,
                List<String> warnings) {
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
                    allocation.getUpdatedAt(),
                    allocation.isBillable(),
                    allocation.getSource(),
                    allocation.getNotes(),
                    allocation.getMilestoneId(),
                    allocation.getEndedAt(),
                    warnings == null ? List.of() : warnings);
        }
    }

    public record CreateAllocationRequest(
            UUID organizationId,
            @NotNull UUID projectId,
            @NotNull UUID resourceId,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            @DecimalMin("0") BigDecimal allocatedHours,
            @DecimalMin("0") @DecimalMax("500") BigDecimal allocationPercentage,
            @Size(max = 128) String role,
            @DecimalMin("0") BigDecimal billingRate,
            @DecimalMin("0") BigDecimal costRate,
            @Size(max = 32) String status,
            Boolean dryRun,
            Boolean billable,
            @Size(max = 1000) String notes,
            UUID milestoneId,
            @Size(max = 32) String source) {

        public CreateAllocationRequest(
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
                Boolean dryRun) {
            this(organizationId, projectId, resourceId, startDate, endDate, allocatedHours, allocationPercentage,
                    role, billingRate, costRate, status, dryRun, null, null, null, null);
        }
    }

    public record UpdateAllocationRequest(
            LocalDate startDate,
            LocalDate endDate,
            @DecimalMin("0") BigDecimal allocatedHours,
            @DecimalMin("0") @DecimalMax("500") BigDecimal allocationPercentage,
            @Size(max = 128) String role,
            @DecimalMin("0") BigDecimal billingRate,
            @DecimalMin("0") BigDecimal costRate,
            @Size(max = 32) String status,
            Boolean dryRun,
            Boolean billable,
            @Size(max = 1000) String notes,
            UUID milestoneId,
            Boolean clearMilestone) {}

    public record EndAllocationRequest(LocalDate endDate, @Size(max = 500) String reason) {}

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
