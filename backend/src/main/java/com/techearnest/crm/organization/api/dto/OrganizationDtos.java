package com.techearnest.crm.organization.api.dto;

import com.techearnest.crm.organization.domain.Organization;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class OrganizationDtos {

    private OrganizationDtos() {}

    public record OrganizationResponse(
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
            Instant updatedAt) {

        public static OrganizationResponse from(Organization org) {
            return new OrganizationResponse(
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
                    org.getUpdatedAt());
        }
    }

    public record CreateOrganizationRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Size(max = 100) String slug,
            @Size(max = 255) String legalName,
            @Email @Size(max = 255) String email,
            @Size(max = 50) String phone,
            @Size(max = 255) String website,
            @Size(max = 64) String timezone,
            @Size(max = 16) String locale,
            @Size(min = 3, max = 3) String currencyCode) {}

    public record UpdateOrganizationRequest(
            @NotBlank @Size(max = 255) String name,
            @Size(max = 255) String legalName,
            @Email @Size(max = 255) String email,
            @Size(max = 50) String phone,
            @Size(max = 255) String website,
            @Size(max = 64) String timezone,
            @Size(max = 16) String locale,
            @Size(min = 3, max = 3) String currencyCode,
            @Size(max = 32) String status) {}
}
