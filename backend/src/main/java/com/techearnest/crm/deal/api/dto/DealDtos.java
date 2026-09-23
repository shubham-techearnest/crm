package com.techearnest.crm.deal.api.dto;

import com.techearnest.crm.deal.domain.Deal;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class DealDtos {

    private DealDtos() {}

    public record DealResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID accountId,
            UUID contactId,
            UUID ownerId,
            UUID leadId,
            String name,
            String stage,
            BigDecimal value,
            BigDecimal probability,
            LocalDate expectedCloseDate,
            String source,
            String description,
            String competitor,
            Instant wonAt,
            Instant lostAt,
            String lostReason,
            Long version,
            Instant createdAt,
            Instant updatedAt) {

        public static DealResponse from(Deal deal) {
            return new DealResponse(
                    deal.getId(),
                    deal.getOrganizationId(),
                    deal.getRegionId(),
                    deal.getAccountId(),
                    deal.getContactId(),
                    deal.getOwnerId(),
                    deal.getLeadId(),
                    deal.getName(),
                    deal.getStage(),
                    deal.getValue(),
                    deal.getProbability(),
                    deal.getExpectedCloseDate(),
                    deal.getSource(),
                    deal.getDescription(),
                    deal.getCompetitor(),
                    deal.getWonAt(),
                    deal.getLostAt(),
                    deal.getLostReason(),
                    deal.getVersion(),
                    deal.getCreatedAt(),
                    deal.getUpdatedAt());
        }
    }

    public record CreateDealRequest(
            UUID organizationId,
            @NotNull UUID accountId,
            UUID contactId,
            UUID ownerId,
            UUID leadId,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 32) String stage,
            BigDecimal value,
            BigDecimal probability,
            LocalDate expectedCloseDate,
            @Size(max = 64) String source,
            String description,
            @Size(max = 255) String competitor) {}

    public record UpdateDealRequest(
            UUID contactId,
            UUID ownerId,
            @NotBlank @Size(max = 255) String name,
            BigDecimal value,
            BigDecimal probability,
            LocalDate expectedCloseDate,
            @Size(max = 64) String source,
            String description,
            @Size(max = 255) String competitor) {}

    public record StageChangeRequest(
            @NotBlank @Size(max = 32) String toStage,
            @Size(max = 255) String lostReason,
            LocalDate expectedCloseDate) {}

    public record PipelineColumn(String stage, List<DealResponse> deals, BigDecimal totalValue) {}
}
