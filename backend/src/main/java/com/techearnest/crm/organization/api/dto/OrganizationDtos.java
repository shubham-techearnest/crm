package com.techearnest.crm.organization.api.dto;

import com.techearnest.crm.organization.domain.Organization;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
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
            Instant updatedAt,
            String addressLine,
            String city,
            String state,
            String country,
            String postalCode,
            String taxId,
            String dateFormat,
            String timeFormat,
            String weekStartDay,
            Integer fiscalYearStartMonth) {

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
                    org.getUpdatedAt(),
                    org.getAddressLine(),
                    org.getCity(),
                    org.getState(),
                    org.getCountry(),
                    org.getPostalCode(),
                    org.getTaxId(),
                    org.getDateFormat(),
                    org.getTimeFormat(),
                    org.getWeekStartDay(),
                    org.getFiscalYearStartMonth());
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
            @Size(max = 32) String status,
            @Size(max = 255) String addressLine,
            @Size(max = 128) String city,
            @Size(max = 128) String state,
            @Size(max = 128) String country,
            @Size(max = 32) String postalCode,
            @Size(max = 64) String taxId,
            @Pattern(regexp = "^$|dd/MM/yyyy|MM/dd/yyyy|yyyy-MM-dd|dd-MM-yyyy|dd MMM yyyy") String dateFormat,
            @Pattern(regexp = "^$|12h|24h") String timeFormat,
            @Pattern(regexp = "^$|SUNDAY|MONDAY|SATURDAY") String weekStartDay,
            @Min(1) @Max(12) Integer fiscalYearStartMonth) {}
}
