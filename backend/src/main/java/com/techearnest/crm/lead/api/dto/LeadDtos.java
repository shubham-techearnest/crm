package com.techearnest.crm.lead.api.dto;

import com.techearnest.crm.lead.domain.Lead;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class LeadDtos {

    private LeadDtos() {}

    public record LeadResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID ownerId,
            String salutation,
            String firstName,
            String lastName,
            String companyName,
            String email,
            String phone,
            String mobile,
            String fax,
            String website,
            String source,
            boolean emailOptOut,
            Integer noOfEmployees,
            String rating,
            String skypeId,
            String secondaryEmail,
            String twitter,
            String addressCountry,
            String addressFlat,
            String addressStreet,
            String addressCity,
            String addressState,
            String addressZip,
            BigDecimal addressLatitude,
            BigDecimal addressLongitude,
            UUID photoDocumentId,
            String status,
            String priority,
            String industry,
            String designation,
            BigDecimal estimatedValue,
            LocalDate expectedCloseDate,
            String description,
            UUID convertedAccountId,
            UUID convertedContactId,
            UUID convertedDealId,
            Instant convertedAt,
            Long version,
            Instant createdAt,
            Instant updatedAt) {

        public static LeadResponse from(Lead lead) {
            return new LeadResponse(
                    lead.getId(),
                    lead.getOrganizationId(),
                    lead.getRegionId(),
                    lead.getOwnerId(),
                    lead.getSalutation(),
                    lead.getFirstName(),
                    lead.getLastName(),
                    lead.getCompanyName(),
                    lead.getEmail(),
                    lead.getPhone(),
                    lead.getMobile(),
                    lead.getFax(),
                    lead.getWebsite(),
                    lead.getSource(),
                    lead.isEmailOptOut(),
                    lead.getNoOfEmployees(),
                    lead.getRating(),
                    lead.getSkypeId(),
                    lead.getSecondaryEmail(),
                    lead.getTwitter(),
                    lead.getAddressCountry(),
                    lead.getAddressFlat(),
                    lead.getAddressStreet(),
                    lead.getAddressCity(),
                    lead.getAddressState(),
                    lead.getAddressZip(),
                    lead.getAddressLatitude(),
                    lead.getAddressLongitude(),
                    lead.getPhotoDocumentId(),
                    lead.getStatus(),
                    lead.getPriority(),
                    lead.getIndustry(),
                    lead.getDesignation(),
                    lead.getEstimatedValue(),
                    lead.getExpectedCloseDate(),
                    lead.getDescription(),
                    lead.getConvertedAccountId(),
                    lead.getConvertedContactId(),
                    lead.getConvertedDealId(),
                    lead.getConvertedAt(),
                    lead.getVersion(),
                    lead.getCreatedAt(),
                    lead.getUpdatedAt());
        }
    }

    public record CreateLeadRequest(
            UUID organizationId,
            @NotNull UUID regionId,
            UUID ownerId,
            @Size(max = 16) String salutation,
            @Size(max = 100) String firstName,
            @Size(max = 100) String lastName,
            @Size(max = 255) String companyName,
            @Size(max = 255) String email,
            @Size(max = 50) String phone,
            @Size(max = 50) String mobile,
            @Size(max = 50) String fax,
            @Size(max = 255) String website,
            @Size(max = 64) String source,
            Boolean emailOptOut,
            Integer noOfEmployees,
            @Size(max = 32) String rating,
            @Size(max = 128) String skypeId,
            @Size(max = 255) String secondaryEmail,
            @Size(max = 128) String twitter,
            @Size(max = 128) String addressCountry,
            @Size(max = 255) String addressFlat,
            @Size(max = 255) String addressStreet,
            @Size(max = 128) String addressCity,
            @Size(max = 128) String addressState,
            @Size(max = 32) String addressZip,
            BigDecimal addressLatitude,
            BigDecimal addressLongitude,
            @Size(max = 32) String status,
            @Size(max = 16) String priority,
            @Size(max = 64) String industry,
            @Size(max = 128) String designation,
            BigDecimal estimatedValue,
            LocalDate expectedCloseDate,
            String description) {}

    public record UpdateLeadRequest(
            UUID regionId,
            UUID ownerId,
            @Size(max = 16) String salutation,
            @Size(max = 100) String firstName,
            @Size(max = 100) String lastName,
            @Size(max = 255) String companyName,
            @Size(max = 255) String email,
            @Size(max = 50) String phone,
            @Size(max = 50) String mobile,
            @Size(max = 50) String fax,
            @Size(max = 255) String website,
            @Size(max = 64) String source,
            Boolean emailOptOut,
            Integer noOfEmployees,
            @Size(max = 32) String rating,
            @Size(max = 128) String skypeId,
            @Size(max = 255) String secondaryEmail,
            @Size(max = 128) String twitter,
            @Size(max = 128) String addressCountry,
            @Size(max = 255) String addressFlat,
            @Size(max = 255) String addressStreet,
            @Size(max = 128) String addressCity,
            @Size(max = 128) String addressState,
            @Size(max = 32) String addressZip,
            BigDecimal addressLatitude,
            BigDecimal addressLongitude,
            UUID photoDocumentId,
            @Size(max = 32) String status,
            @Size(max = 16) String priority,
            @Size(max = 64) String industry,
            @Size(max = 128) String designation,
            BigDecimal estimatedValue,
            LocalDate expectedCloseDate,
            String description) {}

    public record AssignLeadRequest(@NotNull UUID ownerId) {}

    public record BulkAssignLeadRequest(
            @NotNull java.util.List<@NotNull UUID> leadIds, @NotNull UUID ownerId) {}

    public record BulkStatusLeadRequest(
            @NotNull java.util.List<@NotNull UUID> leadIds, @NotBlank @Size(max = 32) String status) {}

    public record BulkLeadItemFailure(UUID leadId, String reason) {}

    public record BulkLeadResult(int succeeded, int failed, java.util.List<BulkLeadItemFailure> failures) {}

    public record DuplicateCheckRequest(
            UUID organizationId, @Size(max = 255) String email, @Size(max = 255) String companyName) {}

    public record DuplicateMatch(
            UUID id, String firstName, String lastName, String companyName, String email, String status) {}

    public record DuplicateCheckResponse(boolean hasDuplicates, java.util.List<DuplicateMatch> matches) {}

    public record ConvertLeadRequest(
            Boolean createAccount,
            Boolean createContact,
            Boolean createDeal,
            UUID accountId,
            @Size(max = 255) String dealName,
            BigDecimal dealValue,
            @Size(max = 32) String dealStage) {}

    public record ConvertLeadResponse(UUID accountId, UUID contactId, UUID dealId) {}

    public record SortSpec(String field, String direction) {}

    public record QueryLeadRequest(
            UUID organizationId,
            String search,
            com.techearnest.crm.filter.FilterNode filter,
            java.util.List<SortSpec> sort,
            Integer page,
            Integer size) {}
}
