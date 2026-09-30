package com.techearnest.crm.timesheet.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** A single-purpose, expiring link that lets a resource without a login fill in one week's timesheet. */
@Entity
@Table(name = "timesheet_links")
public class TimesheetLink {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "resource_id", nullable = false)
    private UUID resourceId;

    @Column(name = "week_start_date", nullable = false)
    private LocalDate weekStartDate;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "last_opened_at")
    private Instant lastOpenedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static TimesheetLink issue(
            UUID organizationId,
            UUID resourceId,
            LocalDate weekStartDate,
            String tokenHash,
            Instant expiresAt,
            UUID createdBy) {
        TimesheetLink link = new TimesheetLink();
        link.id = UUID.randomUUID();
        link.organizationId = organizationId;
        link.resourceId = resourceId;
        link.weekStartDate = weekStartDate;
        link.tokenHash = tokenHash;
        link.expiresAt = expiresAt;
        link.createdBy = createdBy;
        link.createdAt = Instant.now();
        return link;
    }

    public boolean isUsable(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public void markOpened() {
        this.lastOpenedAt = Instant.now();
    }

    public void markSubmitted() {
        this.submittedAt = Instant.now();
    }

    public void revoke() {
        if (revokedAt == null) {
            this.revokedAt = Instant.now();
        }
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

    public LocalDate getWeekStartDate() {
        return weekStartDate;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }
}
