package com.techearnest.crm.expense.domain;

import com.techearnest.crm.common.security.SecuredRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "expenses")
public class Expense implements SecuredRecord {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_SUBMITTED = "SUBMITTED";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "region_id", nullable = false)
    private UUID regionId;

    @Column(name = "resource_id")
    private UUID resourceId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "purchase_order_id")
    private UUID purchaseOrderId;

    @Column(nullable = false, length = 64)
    private String category;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode = "INR";

    @Column(name = "expense_date", nullable = false)
    private LocalDate expenseDate;

    @Column(nullable = false)
    private boolean billable = false;

    @Column(nullable = false, length = 32)
    private String status = STATUS_DRAFT;

    @Column(name = "approval_request_id")
    private UUID approvalRequestId;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_by")
    private UUID approvedBy;

    @Column(name = "rejected_at")
    private Instant rejectedAt;

    @Column(name = "rejected_by")
    private UUID rejectedBy;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static Expense create(
            UUID organizationId,
            UUID regionId,
            UUID resourceId,
            UUID projectId,
            String category,
            String description,
            BigDecimal amount,
            String currencyCode,
            LocalDate expenseDate,
            boolean billable,
            String notes,
            UUID createdBy) {
        Expense expense = new Expense();
        expense.id = UUID.randomUUID();
        expense.organizationId = organizationId;
        expense.regionId = regionId;
        expense.resourceId = resourceId;
        expense.projectId = projectId;
        expense.category = category.trim();
        expense.description = blankToNull(description);
        expense.amount = money(amount);
        expense.currencyCode =
                currencyCode == null || currencyCode.isBlank() ? "INR" : currencyCode.trim().toUpperCase();
        expense.expenseDate = expenseDate;
        expense.billable = billable;
        expense.status = STATUS_DRAFT;
        expense.notes = blankToNull(notes);
        expense.createdAt = Instant.now();
        expense.updatedAt = Instant.now();
        expense.createdBy = createdBy;
        expense.updatedBy = createdBy;
        return expense;
    }

    public void update(
            UUID resourceId,
            UUID projectId,
            String category,
            String description,
            BigDecimal amount,
            String currencyCode,
            LocalDate expenseDate,
            Boolean billable,
            String notes,
            UUID updatedBy) {
        if (resourceId != null) {
            this.resourceId = resourceId;
        }
        if (projectId != null) {
            this.projectId = projectId;
        }
        if (category != null && !category.isBlank()) {
            this.category = category.trim();
        }
        if (description != null) {
            this.description = blankToNull(description);
        }
        if (amount != null) {
            this.amount = money(amount);
        }
        if (currencyCode != null && !currencyCode.isBlank()) {
            this.currencyCode = currencyCode.trim().toUpperCase();
        }
        if (expenseDate != null) {
            this.expenseDate = expenseDate;
        }
        if (billable != null) {
            this.billable = billable;
        }
        if (notes != null) {
            this.notes = blankToNull(notes);
        }
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }

    public boolean isEditable() {
        return STATUS_DRAFT.equals(status) || STATUS_REJECTED.equals(status);
    }

    public void submit() {
        this.status = STATUS_SUBMITTED;
        this.submittedAt = Instant.now();
        this.rejectedAt = null;
        this.rejectedBy = null;
        this.rejectionReason = null;
        this.updatedAt = Instant.now();
    }

    public void approve(UUID actorId) {
        this.status = STATUS_APPROVED;
        this.approvedAt = Instant.now();
        this.approvedBy = actorId;
        this.updatedBy = actorId;
        this.updatedAt = Instant.now();
    }

    public void reject(UUID actorId, String reason) {
        this.status = STATUS_REJECTED;
        this.rejectedAt = Instant.now();
        this.rejectedBy = actorId;
        this.rejectionReason = reason;
        this.updatedBy = actorId;
        this.updatedAt = Instant.now();
    }

    public void setApprovalRequestId(UUID approvalRequestId) {
        this.approvalRequestId = approvalRequestId;
        this.updatedAt = Instant.now();
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    private static BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
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
        return createdBy;
    }

    public UUID getId() {
        return id;
    }

    public UUID getResourceId() {
        return resourceId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getPurchaseOrderId() {
        return purchaseOrderId;
    }

    public String getCategory() {
        return category;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public LocalDate getExpenseDate() {
        return expenseDate;
    }

    public boolean isBillable() {
        return billable;
    }

    public String getStatus() {
        return status;
    }

    public UUID getApprovalRequestId() {
        return approvalRequestId;
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

    public Instant getRejectedAt() {
        return rejectedAt;
    }

    public UUID getRejectedBy() {
        return rejectedBy;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
