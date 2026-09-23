package com.techearnest.crm.account.api.dto;

import com.techearnest.crm.account.domain.Account;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class AccountDtos {

    private AccountDtos() {}

    public record AccountResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID ownerId,
            String name,
            String industry,
            String website,
            String email,
            String phone,
            String billingAddress,
            String shippingAddress,
            String taxNumber,
            String status,
            String accountType,
            String description,
            Long version,
            Instant createdAt,
            Instant updatedAt) {

        public static AccountResponse from(Account account) {
            return new AccountResponse(
                    account.getId(),
                    account.getOrganizationId(),
                    account.getRegionId(),
                    account.getOwnerId(),
                    account.getName(),
                    account.getIndustry(),
                    account.getWebsite(),
                    account.getEmail(),
                    account.getPhone(),
                    account.getBillingAddress(),
                    account.getShippingAddress(),
                    account.getTaxNumber(),
                    account.getStatus(),
                    account.getAccountType(),
                    account.getDescription(),
                    account.getVersion(),
                    account.getCreatedAt(),
                    account.getUpdatedAt());
        }
    }

    public record CreateAccountRequest(
            UUID organizationId,
            @NotNull UUID regionId,
            UUID ownerId,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 64) String industry,
            @Size(max = 255) String website,
            @Size(max = 255) String email,
            @Size(max = 50) String phone,
            String billingAddress,
            String shippingAddress,
            @Size(max = 64) String taxNumber,
            @Size(max = 32) String status,
            @NotBlank @Size(max = 32) String accountType,
            String description) {}

    public record UpdateAccountRequest(
            UUID regionId,
            UUID ownerId,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 64) String industry,
            @Size(max = 255) String website,
            @Size(max = 255) String email,
            @Size(max = 50) String phone,
            String billingAddress,
            String shippingAddress,
            @Size(max = 64) String taxNumber,
            @Size(max = 32) String status,
            @Size(max = 32) String accountType,
            String description) {}
}
