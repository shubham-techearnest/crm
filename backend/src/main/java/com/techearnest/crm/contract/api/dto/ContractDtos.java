package com.techearnest.crm.contract.api.dto;

import com.techearnest.crm.contract.domain.Contract;
import com.techearnest.crm.filter.FilterNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class ContractDtos {

    private ContractDtos() {}

    public record ContractResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID accountId,
            UUID projectId,
            String name,
            String contractNumber,
            String status,
            BigDecimal valueAmount,
            String currencyCode,
            LocalDate startDate,
            LocalDate endDate,
            boolean autoRenew,
            int renewalNoticeDays,
            String terms,
            UUID ownerId,
            Instant createdAt,
            Instant updatedAt) {
        public static ContractResponse from(Contract contract) {
            return new ContractResponse(
                    contract.getId(),
                    contract.getOrganizationId(),
                    contract.getRegionId(),
                    contract.getAccountId(),
                    contract.getProjectId(),
                    contract.getName(),
                    contract.getContractNumber(),
                    contract.getStatus(),
                    contract.getValueAmount(),
                    contract.getCurrencyCode(),
                    contract.getStartDate(),
                    contract.getEndDate(),
                    contract.isAutoRenew(),
                    contract.getRenewalNoticeDays(),
                    contract.getTerms(),
                    contract.getOwnerId(),
                    contract.getCreatedAt(),
                    contract.getUpdatedAt());
        }
    }

    public record CreateContractRequest(
            UUID organizationId,
            @NotNull UUID regionId,
            @NotNull UUID accountId,
            UUID projectId,
            @NotBlank String name,
            String contractNumber,
            BigDecimal valueAmount,
            String currencyCode,
            LocalDate startDate,
            LocalDate endDate,
            Boolean autoRenew,
            Integer renewalNoticeDays,
            String terms,
            UUID ownerId,
            String status) {}

    public record UpdateContractRequest(
            String name,
            UUID projectId,
            BigDecimal valueAmount,
            String currencyCode,
            LocalDate startDate,
            LocalDate endDate,
            Boolean autoRenew,
            Integer renewalNoticeDays,
            String terms,
            UUID ownerId,
            String status) {}

    public record QueryContractRequest(
            FilterNode filter,
            String search,
            String status,
            UUID accountId,
            Boolean autoRenew,
            UUID organizationId,
            Integer page,
            Integer size) {}
}
