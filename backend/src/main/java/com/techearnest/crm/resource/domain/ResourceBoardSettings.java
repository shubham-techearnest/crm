package com.techearnest.crm.resource.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Per-organization thresholds that classify resources on the resource board. */
@Entity
@Table(name = "resource_board_settings")
@EntityListeners(AuditingEntityListener.class)
public class ResourceBoardSettings {

    public static final int DEFAULT_ENDING_SOON_DAYS = 14;
    public static final BigDecimal DEFAULT_BENCH_MAX_PCT = BigDecimal.ZERO;
    public static final BigDecimal DEFAULT_FULL_PCT = BigDecimal.valueOf(100);
    public static final BigDecimal DEFAULT_OVER_PCT = BigDecimal.valueOf(100);
    public static final int DEFAULT_FORECAST_WEEKS = 12;

    @Id
    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "ending_soon_days", nullable = false)
    private int endingSoonDays;

    @Column(name = "bench_max_allocation_pct", nullable = false)
    private BigDecimal benchMaxAllocationPct;

    @Column(name = "full_allocation_pct", nullable = false)
    private BigDecimal fullAllocationPct;

    @Column(name = "overallocation_pct", nullable = false)
    private BigDecimal overallocationPct;

    @Column(name = "forecast_weeks", nullable = false)
    private int forecastWeeks;

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

    public static ResourceBoardSettings defaults(UUID organizationId) {
        ResourceBoardSettings settings = new ResourceBoardSettings();
        settings.organizationId = organizationId;
        settings.endingSoonDays = DEFAULT_ENDING_SOON_DAYS;
        settings.benchMaxAllocationPct = DEFAULT_BENCH_MAX_PCT;
        settings.fullAllocationPct = DEFAULT_FULL_PCT;
        settings.overallocationPct = DEFAULT_OVER_PCT;
        settings.forecastWeeks = DEFAULT_FORECAST_WEEKS;
        return settings;
    }

    public void update(
            Integer endingSoonDays,
            BigDecimal benchMaxAllocationPct,
            BigDecimal fullAllocationPct,
            BigDecimal overallocationPct,
            Integer forecastWeeks) {
        if (endingSoonDays != null) {
            this.endingSoonDays = endingSoonDays;
        }
        if (benchMaxAllocationPct != null) {
            this.benchMaxAllocationPct = benchMaxAllocationPct;
        }
        if (fullAllocationPct != null) {
            this.fullAllocationPct = fullAllocationPct;
        }
        if (overallocationPct != null) {
            this.overallocationPct = overallocationPct;
        }
        if (forecastWeeks != null) {
            this.forecastWeeks = forecastWeeks;
        }
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public int getEndingSoonDays() {
        return endingSoonDays;
    }

    public BigDecimal getBenchMaxAllocationPct() {
        return benchMaxAllocationPct;
    }

    public BigDecimal getFullAllocationPct() {
        return fullAllocationPct;
    }

    public BigDecimal getOverallocationPct() {
        return overallocationPct;
    }

    public int getForecastWeeks() {
        return forecastWeeks;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
