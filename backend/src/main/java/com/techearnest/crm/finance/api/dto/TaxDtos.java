package com.techearnest.crm.finance.api.dto;

import com.techearnest.crm.finance.domain.TaxRate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class TaxDtos {

    private TaxDtos() {}

    public record TaxRateResponse(
            UUID id,
            UUID organizationId,
            String code,
            String name,
            BigDecimal ratePercent,
            String jurisdiction,
            String taxType,
            boolean active,
            String description,
            Instant createdAt,
            Instant updatedAt) {
        public static TaxRateResponse from(TaxRate rate) {
            return new TaxRateResponse(
                    rate.getId(),
                    rate.getOrganizationId(),
                    rate.getCode(),
                    rate.getName(),
                    rate.getRatePercent(),
                    rate.getJurisdiction(),
                    rate.getTaxType(),
                    rate.isActive(),
                    rate.getDescription(),
                    rate.getCreatedAt(),
                    rate.getUpdatedAt());
        }
    }

    public record CreateTaxRateRequest(
            UUID organizationId,
            @NotBlank String code,
            @NotBlank String name,
            @NotNull BigDecimal ratePercent,
            String jurisdiction,
            String taxType,
            String description) {}

    public record UpdateTaxRateRequest(
            String name,
            BigDecimal ratePercent,
            String jurisdiction,
            String taxType,
            Boolean active,
            String description) {}
}
