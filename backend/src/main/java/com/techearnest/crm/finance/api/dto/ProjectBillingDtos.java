package com.techearnest.crm.finance.api.dto;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ProjectBillingDtos {

    private ProjectBillingDtos() {}

    /**
     * Period applies to hourly and monthly projects (defaults to the current month); {@code amount} and
     * {@code description} apply to fixed bid instalments (amount defaults to the unbilled remainder).
     */
    public record ProjectInvoiceRequest(
            LocalDate periodStart,
            LocalDate periodEnd,
            @PositiveOrZero BigDecimal amount,
            @Size(max = 300) String description,
            UUID taxRateId,
            LocalDate dueDate) {}

    public record ProjectInvoiceLine(
            String description, BigDecimal quantity, BigDecimal unitPrice, BigDecimal amount, UUID timeEntryId) {}

    public record ProjectInvoicePreview(
            UUID projectId,
            String billingType,
            LocalDate periodStart,
            LocalDate periodEnd,
            List<ProjectInvoiceLine> lines,
            BigDecimal subtotal,
            BigDecimal contractValue,
            BigDecimal billedToDate,
            BigDecimal remaining,
            List<String> warnings,
            String blockedReason) {}
}
