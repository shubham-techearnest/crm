package com.techearnest.crm.timesheet.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "timesheets")
@EntityListeners(AuditingEntityListener.class)
public class Timesheet {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_SUBMITTED = "SUBMITTED";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";

    /** Entered by the resource's own login. */
    public static final String SOURCE_SELF = "SELF";
    /** Entered by a manager on the resource's behalf. */
    public static final String SOURCE_PROXY = "PROXY";
    /** Submitted by the resource through an emailed secure link, without a login. */
    public static final String SOURCE_LINK = "LINK";
    /** Created from a spreadsheet import. */
    public static final String SOURCE_IMPORT = "IMPORT";

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "resource_id", nullable = false)
    private UUID resourceId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "week_start_date", nullable = false)
    private LocalDate weekStartDate;

    @Column(nullable = false)
    private String status;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_by")
    private UUID approvedBy;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Column(name = "entered_by")
    private UUID enteredBy;

    @Column(name = "entry_source", nullable = false)
    private String entrySource = SOURCE_SELF;

    @Column(length = 2000)
    private String notes;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Version
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

    public static Timesheet create(UUID organizationId, UUID resourceId, UUID regionId, LocalDate weekStartDate) {
        Timesheet timesheet = new Timesheet();
        timesheet.id = UUID.randomUUID();
        timesheet.organizationId = organizationId;
        timesheet.resourceId = resourceId;
        timesheet.regionId = regionId;
        timesheet.weekStartDate = weekStartDate;
        timesheet.status = STATUS_DRAFT;
        return timesheet;
    }

    public void recordEntry(String source, UUID enteredBy) {
        this.entrySource = source;
        this.enteredBy = enteredBy;
    }

    public void submit() {
        this.status = STATUS_SUBMITTED;
        this.submittedAt = Instant.now();
        this.approvedAt = null;
        this.approvedBy = null;
        this.rejectionReason = null;
    }

    public void approve(UUID approverId) {
        this.status = STATUS_APPROVED;
        this.approvedAt = Instant.now();
        this.approvedBy = approverId;
        this.rejectionReason = null;
    }

    public void reject(UUID approverId, String reason) {
        this.status = STATUS_REJECTED;
        this.approvedAt = Instant.now();
        this.approvedBy = approverId;
        this.rejectionReason = reason;
    }

    public void updateNotes(String notes) {
        this.notes = notes;
    }

    public boolean isEditable() {
        return STATUS_DRAFT.equals(status) || STATUS_REJECTED.equals(status);
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

    public UUID getRegionId() {
        return regionId;
    }

    public LocalDate getWeekStartDate() {
        return weekStartDate;
    }

    public String getStatus() {
        return status;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public UUID getApprovedBy() {
        return approvedBy;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public UUID getEnteredBy() {
        return enteredBy;
    }

    public String getEntrySource() {
        return entrySource;
    }

    public String getNotes() {
        return notes;
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
