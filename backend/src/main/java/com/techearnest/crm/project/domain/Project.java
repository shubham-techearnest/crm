package com.techearnest.crm.project.domain;

import com.techearnest.crm.common.security.SecuredRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.domain.Persistable;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "projects")
@EntityListeners(AuditingEntityListener.class)
public class Project implements SecuredRecord, Persistable<UUID> {

    @Id
    private UUID id;

    @Transient
    private boolean newEntity = true;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "deal_id")
    private UUID dealId;

    @Column(name = "project_manager_id", nullable = false)
    private UUID projectManagerId;

    @Column(nullable = false)
    private String name;

    @Column(name = "project_code", nullable = false)
    private String projectCode;

    private String description;

    @Column(nullable = false)
    private String status;

    private String priority;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    private BigDecimal budget;

    @Column(name = "estimated_hours")
    private BigDecimal estimatedHours;

    @Column(name = "actual_hours", nullable = false)
    private BigDecimal actualHours;

    @Column(name = "billing_type", nullable = false)
    private String billingType;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Version
    @Column(nullable = false)
    private Long version;

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

    public static Project create(
            UUID organizationId,
            UUID regionId,
            UUID accountId,
            UUID dealId,
            UUID projectManagerId,
            String name,
            String projectCode,
            String description,
            String status,
            String priority,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal budget,
            BigDecimal estimatedHours,
            String billingType) {
        Project project = new Project();
        project.id = UUID.randomUUID();
        project.organizationId = organizationId;
        project.regionId = regionId;
        project.accountId = accountId;
        project.dealId = dealId;
        project.projectManagerId = projectManagerId;
        project.name = name;
        project.projectCode = projectCode;
        project.description = description;
        project.status = status != null && !status.isBlank() ? status : "ACTIVE";
        project.priority = priority;
        project.startDate = startDate;
        project.endDate = endDate;
        project.budget = budget;
        project.estimatedHours = estimatedHours;
        project.actualHours = BigDecimal.ZERO;
        project.billingType = billingType != null && !billingType.isBlank() ? billingType : "FIXED_PRICE";
        return project;
    }

    public void update(
            UUID regionId,
            UUID accountId,
            UUID projectManagerId,
            String name,
            String description,
            String status,
            String priority,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal budget,
            BigDecimal estimatedHours,
            String billingType) {
        if (regionId != null) {
            this.regionId = regionId;
        }
        if (accountId != null) {
            this.accountId = accountId;
        }
        if (projectManagerId != null) {
            this.projectManagerId = projectManagerId;
        }
        if (name != null && !name.isBlank()) {
            this.name = name;
        }
        this.description = description;
        if (status != null && !status.isBlank()) {
            this.status = status;
        }
        this.priority = priority;
        this.startDate = startDate;
        this.endDate = endDate;
        this.budget = budget;
        this.estimatedHours = estimatedHours;
        if (billingType != null && !billingType.isBlank()) {
            this.billingType = billingType;
        }
    }

    public void addActualHours(BigDecimal hours) {
        if (hours == null) {
            return;
        }
        this.actualHours = (this.actualHours == null ? BigDecimal.ZERO : this.actualHours).add(hours);
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }

    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.newEntity = false;
    }

    @Override
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
        return projectManagerId;
    }

    public UUID getAccountId() {
        return accountId;
    }

    public UUID getDealId() {
        return dealId;
    }

    public UUID getProjectManagerId() {
        return projectManagerId;
    }

    public String getName() {
        return name;
    }

    public String getProjectCode() {
        return projectCode;
    }

    public String getDescription() {
        return description;
    }

    public String getStatus() {
        return status;
    }

    public String getPriority() {
        return priority;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public BigDecimal getBudget() {
        return budget;
    }

    public BigDecimal getEstimatedHours() {
        return estimatedHours;
    }

    public BigDecimal getActualHours() {
        return actualHours;
    }

    public String getBillingType() {
        return billingType;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public Long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
