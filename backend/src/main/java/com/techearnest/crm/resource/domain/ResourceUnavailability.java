package com.techearnest.crm.resource.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Leave, holidays, training or other time a resource cannot work; reduces capacity for those days. */
@Entity
@Table(name = "resource_unavailability")
@EntityListeners(AuditingEntityListener.class)
public class ResourceUnavailability {

    public static final Set<String> KINDS = Set.of("LEAVE", "HOLIDAY", "SICK", "TRAINING", "OTHER");

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "resource_id", nullable = false)
    private UUID resourceId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(nullable = false)
    private String kind;

    /** Hours off per working day; null means the whole working day. */
    @Column(name = "hours_per_day")
    private BigDecimal hoursPerDay;

    private String reason;

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

    public static ResourceUnavailability create(
            UUID organizationId,
            UUID resourceId,
            LocalDate startDate,
            LocalDate endDate,
            String kind,
            BigDecimal hoursPerDay,
            String reason) {
        ResourceUnavailability value = new ResourceUnavailability();
        value.id = UUID.randomUUID();
        value.organizationId = organizationId;
        value.resourceId = resourceId;
        value.startDate = startDate;
        value.endDate = endDate;
        value.kind = kind;
        value.hoursPerDay = hoursPerDay;
        value.reason = reason == null || reason.isBlank() ? null : reason.trim();
        return value;
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getResourceId() {
        return resourceId;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public String getKind() {
        return kind;
    }

    public BigDecimal getHoursPerDay() {
        return hoursPerDay;
    }

    public String getReason() {
        return reason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
