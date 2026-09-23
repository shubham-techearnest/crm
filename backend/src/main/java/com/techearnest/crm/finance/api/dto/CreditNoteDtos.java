package com.techearnest.crm.finance.api.dto;

import com.techearnest.crm.finance.domain.CreditNote;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class CreditNoteDtos {

    private CreditNoteDtos() {}

    public record CreditNoteResponse(
            UUID id,
            UUID organizationId,
            UUID invoiceId,
            String creditNumber,
            String status,
            BigDecimal amount,
            String reason,
            LocalDate issueDate,
            Instant appliedAt,
            Instant createdAt,
            Instant updatedAt) {
        public static CreditNoteResponse from(CreditNote note) {
            return new CreditNoteResponse(
                    note.getId(),
                    note.getOrganizationId(),
                    note.getInvoiceId(),
                    note.getCreditNumber(),
                    note.getStatus(),
                    note.getAmount(),
                    note.getReason(),
                    note.getIssueDate(),
                    note.getAppliedAt(),
                    note.getCreatedAt(),
                    note.getUpdatedAt());
        }
    }

    public record CreateCreditNoteRequest(@NotNull BigDecimal amount, String reason) {}
}
