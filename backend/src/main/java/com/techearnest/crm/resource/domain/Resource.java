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
    public static final java.util.Set<String> TYPES =
            java.util.Set.of(TYPE_EMPLOYEE, TYPE_CONTRACTOR, TYPE_FREELANCER, TYPE_CONSULTANT);

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

    /** Contractors, freelancers and consultants: people outside the company's payroll. */
    public boolean isExternal() {
        return !TYPE_EMPLOYEE.equals(resourceType);
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
