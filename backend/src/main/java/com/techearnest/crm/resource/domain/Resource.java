package com.techearnest.crm.resource.domain;

import com.techearnest.crm.common.security.SecuredRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "resources")
@EntityListeners(AuditingEntityListener.class)
public class Resource implements SecuredRecord {

    /** Own employee; always backed by a user account. */
    public static final String TYPE_EMPLOYEE = "EMPLOYEE";
    public static final String TYPE_CONTRACTOR = "CONTRACTOR";
    public static final String TYPE_FREELANCER = "FREELANCER";
    public static final String TYPE_CONSULTANT = "CONSULTANT";
    public static final String TYPE_OTHER_EXTERNAL = "OTHER_EXTERNAL";

    public static final String STATUS_AVAILABLE = "AVAILABLE";
    public static final String STATUS_PARTIALLY_ALLOCATED = "PARTIALLY_ALLOCATED";
    public static final String STATUS_FULLY_ALLOCATED = "FULLY_ALLOCATED";
    public static final String STATUS_ON_LEAVE = "ON_LEAVE";
    public static final String STATUS_UNAVAILABLE = "UNAVAILABLE";
    public static final String STATUS_INACTIVE = "INACTIVE";
    public static final String STATUS_CONTRACT_EXPIRED = "CONTRACT_EXPIRED";
    public static final String STATUS_TERMINATED = "TERMINATED";

    /** Statuses a person sets; allocation-driven statuses are never stored over them. */
    public static final java.util.Set<String> MANUAL_STATUSES = java.util.Set.of(
            STATUS_ON_LEAVE, STATUS_UNAVAILABLE, STATUS_INACTIVE, STATUS_CONTRACT_EXPIRED, STATUS_TERMINATED);
    /** Statuses of people who are no longer part of the active workforce. */
    public static final java.util.Set<String> ENDED_STATUSES =
            java.util.Set.of(STATUS_INACTIVE, STATUS_CONTRACT_EXPIRED, STATUS_TERMINATED);

    public static final String RATE_HOURLY = "HOURLY";
    public static final String RATE_DAILY = "DAILY";
    public static final String RATE_MONTHLY = "MONTHLY";
    public static final java.util.Set<String> RATE_UNITS = java.util.Set.of(RATE_HOURLY, RATE_DAILY, RATE_MONTHLY);

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "employee_code")
    private String employeeCode;

    private String designation;

    @Column(name = "department_id")
    private UUID departmentId;

    @Column(name = "manager_id")
    private UUID managerId;

    @Column(name = "resource_type", nullable = false)
    private String resourceType;

    @Column(name = "joining_date")
    private LocalDate joiningDate;

    @Column(name = "cost_rate")
    private BigDecimal costRate;

    @Column(name = "billing_rate")
    private BigDecimal billingRate;

    @Column(name = "capacity_hours_per_week", nullable = false)
    private BigDecimal capacityHoursPerWeek;

    @Column(nullable = false)
    private String status;

    @Column(name = "full_name")
    private String fullName;

    private String email;

    private String phone;

    @Column(name = "engagement_end_date")
    private LocalDate engagementEndDate;

    @Column(name = "engagement_start_date")
    private LocalDate engagementStartDate;

    @Column(name = "contract_reference")
    private String contractReference;

    @Column(name = "vendor_id")
    private UUID vendorId;

    @Column(name = "working_hours_per_day", nullable = false)
    private BigDecimal workingHoursPerDay = BigDecimal.valueOf(8);

    @Column(name = "working_days_per_week", nullable = false)
    private BigDecimal workingDaysPerWeek = BigDecimal.valueOf(5);

    @Column(name = "experience_years")
    private BigDecimal experienceYears;

    private String location;

    @Column(name = "available_from")
    private LocalDate availableFrom;

    @Column(nullable = false)
    private boolean billable = true;

    @Column(name = "rate_unit", nullable = false)
    private String rateUnit = RATE_HOURLY;

    @Column(name = "deactivated_at")
    private Instant deactivatedAt;

    @Column(name = "deactivation_reason")
    private String deactivationReason;

    /** INTERNAL / EXTERNAL from the resource_types catalogue; null until the entity is reloaded after insert. */
    @org.hibernate.annotations.Formula("(select t.category from resource_types t where t.code = resource_type)")
    private String typeCategory;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private UUID updatedBy;

    public static Resource create(
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
        Resource resource = new Resource();
        resource.id = UUID.randomUUID();
        resource.organizationId = organizationId;
        resource.regionId = regionId;
        resource.userId = userId;
        resource.employeeCode = employeeCode;
        resource.designation = designation;
        resource.departmentId = departmentId;
        resource.managerId = managerId;
        resource.resourceType = resourceType != null && !resourceType.isBlank() ? resourceType : "EMPLOYEE";
        resource.joiningDate = joiningDate;
        resource.costRate = costRate;
        resource.billingRate = billingRate;
        resource.capacityHoursPerWeek =
                capacityHoursPerWeek != null ? capacityHoursPerWeek : BigDecimal.valueOf(40);
        resource.status = status != null && !status.isBlank() ? status : "AVAILABLE";
        return resource;
    }

    public void update(
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
        if (regionId != null) {
            this.regionId = regionId;
        }
        if (userId != null) {
            this.userId = userId;
        }
        if (employeeCode != null) {
            this.employeeCode = employeeCode.isBlank() ? null : employeeCode;
        }
        if (designation != null) {
            this.designation = designation.isBlank() ? null : designation;
        }
        if (departmentId != null) {
            this.departmentId = departmentId;
        }
        if (managerId != null) {
            this.managerId = managerId;
        }
        if (resourceType != null && !resourceType.isBlank()) {
            this.resourceType = resourceType;
        }
        if (joiningDate != null) {
            this.joiningDate = joiningDate;
        }
        if (costRate != null) {
            this.costRate = costRate;
        }
        if (billingRate != null) {
            this.billingRate = billingRate;
        }
        if (capacityHoursPerWeek != null) {
            this.capacityHoursPerWeek = capacityHoursPerWeek;
        }
        if (status != null && !status.isBlank()) {
            this.status = status;
            if (ENDED_STATUSES.contains(status)) {
                if (this.deactivatedAt == null) {
                    this.deactivatedAt = Instant.now();
                }
            } else {
                this.deactivatedAt = null;
                this.deactivationReason = null;
            }
        }
    }

    /** Blank strings clear a value; null leaves it unchanged. */
    public void updateContact(String fullName, String email, String phone, LocalDate engagementEndDate) {
        if (fullName != null) {
            this.fullName = fullName.isBlank() ? null : fullName.trim();
        }
        if (email != null) {
            this.email = email.isBlank() ? null : email.trim().toLowerCase(java.util.Locale.ROOT);
        }
        if (phone != null) {
            this.phone = phone.isBlank() ? null : phone.trim();
        }
        if (engagementEndDate != null) {
            this.engagementEndDate = engagementEndDate;
        }
    }

    public void clearEngagementEndDate() {
        this.engagementEndDate = null;
    }

    /**
     * Profile, capacity and engagement terms. Null leaves a value unchanged; blank strings clear text values.
     * When both working hours per day and days per week are known the weekly capacity follows from them.
     */
    public void updateProfile(
            LocalDate engagementStartDate,
            String contractReference,
            UUID vendorId,
            BigDecimal workingHoursPerDay,
            BigDecimal workingDaysPerWeek,
            BigDecimal experienceYears,
            String location,
            LocalDate availableFrom,
            Boolean billable,
            String rateUnit) {
        if (engagementStartDate != null) {
            this.engagementStartDate = engagementStartDate;
        }
        if (contractReference != null) {
            this.contractReference = contractReference.isBlank() ? null : contractReference.trim();
        }
        if (vendorId != null) {
            this.vendorId = vendorId;
        }
        if (experienceYears != null) {
            this.experienceYears = experienceYears;
        }
        if (location != null) {
            this.location = location.isBlank() ? null : location.trim();
        }
        if (availableFrom != null) {
            this.availableFrom = availableFrom;
        }
        if (billable != null) {
            this.billable = billable;
        }
        if (rateUnit != null && !rateUnit.isBlank()) {
            this.rateUnit = rateUnit.trim().toUpperCase(java.util.Locale.ROOT);
        }
        if (workingHoursPerDay != null) {
            this.workingHoursPerDay = workingHoursPerDay;
        }
        if (workingDaysPerWeek != null) {
            this.workingDaysPerWeek = workingDaysPerWeek;
        }
        if (workingHoursPerDay != null || workingDaysPerWeek != null) {
            this.capacityHoursPerWeek = this.workingHoursPerDay
                    .multiply(this.workingDaysPerWeek)
                    .setScale(2, java.math.RoundingMode.HALF_UP);
        }
    }

    /** Keeps hours per day consistent when only the weekly capacity is edited. */
    public void syncWorkingHoursFromCapacity() {
        if (capacityHoursPerWeek != null && workingDaysPerWeek != null && workingDaysPerWeek.signum() > 0) {
            BigDecimal perDay = capacityHoursPerWeek.divide(workingDaysPerWeek, 2, java.math.RoundingMode.HALF_UP);
            this.workingHoursPerDay = perDay.min(BigDecimal.valueOf(24)).max(new BigDecimal("0.5"));
        }
    }

    public void clearVendor() {
        this.vendorId = null;
    }

    public void clearAvailableFrom() {
        this.availableFrom = null;
    }

    public void clearEngagementStartDate() {
        this.engagementStartDate = null;
    }

    public void deactivate(String status, String reason) {
        this.status = status;
        this.deactivatedAt = Instant.now();
        this.deactivationReason = reason == null || reason.isBlank() ? null : reason.trim();
    }

    public void reactivate(LocalDate engagementStartDate, LocalDate engagementEndDate) {
        this.status = STATUS_AVAILABLE;
        this.deactivatedAt = null;
        this.deactivationReason = null;
        if (engagementStartDate != null) {
            this.engagementStartDate = engagementStartDate;
        }
        this.engagementEndDate = engagementEndDate;
    }

    public boolean isActiveWorkforce() {
        return deletedAt == null && !ENDED_STATUSES.contains(status);
    }

    public void linkUser(UUID userId) {
        this.userId = userId;
    }

    public void setDerivedStatus(String status) {
        this.status = status;
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    @Override
    public UUID getOrganizationId() {
        return organizationId;
    }

    @Override
    public UUID getRegionId() {
        return regionId;
    }

    @Override
    public UUID getOwnerId() {
        return managerId;
    }

    @Override
    public UUID getAssignedUserId() {
        return userId;
    }

    @Override
    public UUID getDepartmentId() {
        return departmentId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getEmployeeCode() {
        return employeeCode;
    }

    public String getDesignation() {
        return designation;
    }

    public UUID getManagerId() {
        return managerId;
    }

    public String getResourceType() {
        return resourceType;
    }

    /** Contractors, freelancers, consultants and other external people outside the company's payroll. */
    public boolean isExternal() {
        if (typeCategory != null) {
            return "EXTERNAL".equals(typeCategory);
        }
        return !TYPE_EMPLOYEE.equals(resourceType);
    }

    public LocalDate getEngagementStartDate() {
        return engagementStartDate;
    }

    public String getContractReference() {
        return contractReference;
    }

    public UUID getVendorId() {
        return vendorId;
    }

    public BigDecimal getWorkingHoursPerDay() {
        return workingHoursPerDay;
    }

    public BigDecimal getWorkingDaysPerWeek() {
        return workingDaysPerWeek;
    }

    public BigDecimal getExperienceYears() {
        return experienceYears;
    }

    public String getLocation() {
        return location;
    }

    public LocalDate getAvailableFrom() {
        return availableFrom;
    }

    public boolean isBillable() {
        return billable;
    }

    public String getRateUnit() {
        return rateUnit;
    }

    public Instant getDeactivatedAt() {
        return deactivatedAt;
    }

    public String getDeactivationReason() {
        return deactivationReason;
    }

    public LocalDate getJoiningDate() {
        return joiningDate;
    }

    public BigDecimal getCostRate() {
        return costRate;
    }

    public BigDecimal getBillingRate() {
        return billingRate;
    }

    public BigDecimal getCapacityHoursPerWeek() {
        return capacityHoursPerWeek;
    }

    public String getStatus() {
        return status;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public LocalDate getEngagementEndDate() {
        return engagementEndDate;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
