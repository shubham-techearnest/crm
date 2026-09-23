package com.techearnest.crm.finance.api.dto;

import com.techearnest.crm.filter.FilterNode;
import com.techearnest.crm.finance.domain.Invoice;
import com.techearnest.crm.finance.domain.InvoiceLine;
import com.techearnest.crm.finance.domain.InvoicePayment;
import com.techearnest.crm.timesheet.domain.TimeEntry;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class InvoiceDtos {

    private InvoiceDtos() {}

    public record InvoiceLineResponse(
            UUID id,
            int lineNo,
            String description,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal amount,
            UUID taxRateId,
            BigDecimal taxAmount,
            UUID projectId,
            UUID timeEntryId) {
        public static InvoiceLineResponse from(InvoiceLine line) {
            return new InvoiceLineResponse(
                    line.getId(),
                    line.getLineNo(),
                    line.getDescription(),
                    line.getQuantity(),
                    line.getUnitPrice(),
                    line.getAmount(),
                    line.getTaxRateId(),
                    line.getTaxAmount(),
                    line.getProjectId(),
                    line.getTimeEntryId());
        }
    }

    public record InvoicePaymentResponse(
            UUID id,
            BigDecimal amount,
            LocalDate paidAt,
            String method,
            String reference,
            String notes,
            Instant createdAt) {
        public static InvoicePaymentResponse from(InvoicePayment payment) {
            return new InvoicePaymentResponse(
                    payment.getId(),
                    payment.getAmount(),
                    payment.getPaidAt(),
                    payment.getMethod(),
                    payment.getReference(),
                    payment.getNotes(),
                    payment.getCreatedAt());
        }
    }

    public record InvoiceResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID accountId,
            UUID projectId,
            String invoiceNumber,
            String status,
            String currencyCode,
            LocalDate issueDate,
            LocalDate dueDate,
            BigDecimal subtotal,
            BigDecimal taxTotal,
            BigDecimal total,
            BigDecimal amountPaid,
            BigDecimal amountCredited,
            BigDecimal balanceDue,
            String notes,
            List<InvoiceLineResponse> lines,
            List<InvoicePaymentResponse> payments,
            List<com.techearnest.crm.finance.api.dto.CreditNoteDtos.CreditNoteResponse> creditNotes,
            Instant createdAt,
            Instant updatedAt) {
        public static InvoiceResponse from(
                Invoice invoice,
                List<InvoiceLine> lines,
                List<InvoicePayment> payments,
                List<com.techearnest.crm.finance.domain.CreditNote> creditNotes) {
            return new InvoiceResponse(
                    invoice.getId(),
                    invoice.getOrganizationId(),
                    invoice.getRegionId(),
                    invoice.getAccountId(),
                    invoice.getProjectId(),
                    invoice.getInvoiceNumber(),
                    invoice.getStatus(),
                    invoice.getCurrencyCode(),
                    invoice.getIssueDate(),
                    invoice.getDueDate(),
                    invoice.getSubtotal(),
                    invoice.getTaxTotal(),
                    invoice.getTotal(),
                    invoice.getAmountPaid(),
                    invoice.getAmountCredited(),
                    invoice.getBalanceDue(),
                    invoice.getNotes(),
                    lines.stream().map(InvoiceLineResponse::from).toList(),
                    payments.stream().map(InvoicePaymentResponse::from).toList(),
                    creditNotes.stream()
                            .map(com.techearnest.crm.finance.api.dto.CreditNoteDtos.CreditNoteResponse::from)
                            .toList(),
                    invoice.getCreatedAt(),
                    invoice.getUpdatedAt());
        }

        public static InvoiceResponse summary(Invoice invoice) {
            return from(invoice, List.of(), List.of(), List.of());
        }
    }

    public record UnbilledTimeEntryResponse(
            UUID id,
            UUID projectId,
            LocalDate workDate,
            BigDecimal hours,
            BigDecimal billingRate,
            String description) {
        public static UnbilledTimeEntryResponse from(TimeEntry entry) {
            return new UnbilledTimeEntryResponse(
                    entry.getId(),
                    entry.getProjectId(),
                    entry.getWorkDate(),
                    entry.getHours(),
                    entry.getBillingRate(),
                    entry.getDescription());
        }
    }

    public record CreateInvoiceRequest(
            UUID organizationId,
            @NotNull UUID regionId,
            @NotNull UUID accountId,
            UUID projectId,
            String currencyCode,
            LocalDate dueDate,
            String notes) {}

    public record AddManualLineRequest(
            @NotBlank String description,
            @NotNull BigDecimal quantity,
            @NotNull BigDecimal unitPrice,
            UUID taxRateId) {}

    public record PullTimeEntriesRequest(@NotNull List<UUID> timeEntryIds, UUID taxRateId) {}

    public record IssueInvoiceRequest(LocalDate issueDate, LocalDate dueDate) {}

    public record RecordPaymentRequest(
            @NotNull BigDecimal amount,
            LocalDate paidAt,
            String method,
            String reference,
            String notes) {}

    public record QueryInvoiceRequest(
            FilterNode filter,
            String search,
            String status,
            UUID accountId,
            UUID projectId,
            Boolean overdueOnly,
            UUID organizationId,
            Integer page,
            Integer size) {}
}
