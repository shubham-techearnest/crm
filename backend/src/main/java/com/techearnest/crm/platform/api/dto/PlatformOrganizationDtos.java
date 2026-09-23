package com.techearnest.crm.platform.api.dto;

import com.techearnest.crm.organization.domain.Organization;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class PlatformOrganizationDtos {

    private PlatformOrganizationDtos() {}

    public record PlatformOrganizationResponse(
            UUID id,
            String name,
            String slug,
            String legalName,
            String email,
            String phone,
            String website,
            String timezone,
            String locale,
            String currencyCode,
            String status,
            Instant createdAt,
            Instant updatedAt,
            Long userCount,
            Long regionCount) {

        public static PlatformOrganizationResponse from(Organization org) {
            return from(org, null, null);
        }

        public static PlatformOrganizationResponse from(Organization org, Long userCount, Long regionCount) {
            return new PlatformOrganizationResponse(
                    org.getId(),
                    org.getName(),
                    org.getSlug(),
                    org.getLegalName(),
                    org.getEmail(),
                    org.getPhone(),
                    org.getWebsite(),
                    org.getTimezone(),
                    org.getLocale(),
                    org.getCurrencyCode(),
                    org.getStatus(),
                    org.getCreatedAt(),
                    org.getUpdatedAt(),
                    userCount,
                    regionCount);
        }
    }

    public record ProvisionOrganizationRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Size(max = 100) String slug,
            @Size(max = 255) String legalName,
            @Email @Size(max = 255) String email,
            @Size(max = 50) String phone,
            @Size(max = 255) String website,
            @Size(max = 64) String timezone,
            @Size(max = 16) String locale,
            @Size(min = 3, max = 3) String currencyCode,
            @NotBlank @Size(max = 120) String defaultRegionName,
            @NotBlank @Size(max = 32) String defaultRegionCode,
            @NotBlank @Email @Size(max = 255) String adminEmail,
            @NotBlank @Size(min = 8, max = 100) String adminPassword,
            @NotBlank @Size(max = 100) String adminFirstName,
            @NotBlank @Size(max = 100) String adminLastName) {}

    public record SetOrganizationStatusRequest(@NotBlank @Size(max = 32) String status) {}
}
