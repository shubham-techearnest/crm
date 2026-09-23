package com.techearnest.crm.expense.api.dto;

import com.techearnest.crm.expense.domain.Expense;
import com.techearnest.crm.filter.FilterNode;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class ExpenseDtos {

    private ExpenseDtos() {}

    public record ExpenseResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID resourceId,
            UUID projectId,
            UUID purchaseOrderId,
            String category,
            String description,
            BigDecimal amount,
            String currencyCode,
            LocalDate expenseDate,
            boolean billable,
            String status,
            UUID approvalRequestId,
            Instant submittedAt,
            Instant approvedAt,
            UUID approvedBy,
            Instant rejectedAt,
            UUID rejectedBy,
            String rejectionReason,
            String notes,
            Instant createdAt,
            Instant updatedAt) {
        public static ExpenseResponse from(Expense expense) {
            return new ExpenseResponse(
                    expense.getId(),
                    expense.getOrganizationId(),
                    expense.getRegionId(),
                    expense.getResourceId(),
                    expense.getProjectId(),
                    expense.getPurchaseOrderId(),
                    expense.getCategory(),
                    expense.getDescription(),
                    expense.getAmount(),
                    expense.getCurrencyCode(),
                    expense.getExpenseDate(),
                    expense.isBillable(),
                    expense.getStatus(),
                    expense.getApprovalRequestId(),
                    expense.getSubmittedAt(),
                    expense.getApprovedAt(),
                    expense.getApprovedBy(),
                    expense.getRejectedAt(),
                    expense.getRejectedBy(),
                    expense.getRejectionReason(),
                    expense.getNotes(),
                    expense.getCreatedAt(),
                    expense.getUpdatedAt());
        }
    }

    public record CreateExpenseRequest(
            UUID organizationId,
            @NotNull UUID regionId,
            UUID resourceId,
            UUID projectId,
            @NotBlank @Size(max = 64) String category,
            @Size(max = 500) String description,
            @NotNull @DecimalMin(value = "0.01", inclusive = true) BigDecimal amount,
            String currencyCode,
            @NotNull LocalDate expenseDate,
            Boolean billable,
            String notes) {}

    public record UpdateExpenseRequest(
            UUID resourceId,
            UUID projectId,
            @Size(max = 64) String category,
            @Size(max = 500) String description,
            @DecimalMin(value = "0.01", inclusive = true) BigDecimal amount,
            String currencyCode,
            LocalDate expenseDate,
            Boolean billable,
            String notes) {}

    public record RejectExpenseRequest(@NotBlank String reason) {}

    public record QueryExpenseRequest(
            FilterNode filter,
            String search,
            String status,
            String category,
            UUID projectId,
            UUID resourceId,
            Boolean billable,
            UUID organizationId,
            Integer page,
            Integer size) {}
}
