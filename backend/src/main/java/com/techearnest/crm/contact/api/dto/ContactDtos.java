package com.techearnest.crm.contact.api.dto;

import com.techearnest.crm.contact.domain.Contact;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class ContactDtos {

    private ContactDtos() {}

    public record ContactResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID accountId,
            UUID ownerId,
            String firstName,
            String lastName,
            String email,
            String phone,
            String mobile,
            String designation,
            String department,
            String linkedinUrl,
            String status,
            String notes,
            Instant createdAt,
            Instant updatedAt) {

        public static ContactResponse from(Contact contact) {
            return new ContactResponse(
                    contact.getId(),
                    contact.getOrganizationId(),
                    contact.getRegionId(),
                    contact.getAccountId(),
                    contact.getOwnerId(),
                    contact.getFirstName(),
                    contact.getLastName(),
                    contact.getEmail(),
                    contact.getPhone(),
                    contact.getMobile(),
                    contact.getDesignation(),
                    contact.getDepartment(),
                    contact.getLinkedinUrl(),
                    contact.getStatus(),
                    contact.getNotes(),
                    contact.getCreatedAt(),
                    contact.getUpdatedAt());
        }
    }

    public record CreateContactRequest(
            UUID organizationId,
            @NotNull UUID accountId,
            UUID ownerId,
            @NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName,
            @Size(max = 255) String email,
            @Size(max = 50) String phone,
            @Size(max = 50) String mobile,
            @Size(max = 128) String designation,
            @Size(max = 128) String department,
            @Size(max = 255) String linkedinUrl,
            @Size(max = 32) String status,
            String notes) {}

    public record UpdateContactRequest(
            UUID ownerId,
            @NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName,
            @Size(max = 255) String email,
            @Size(max = 50) String phone,
            @Size(max = 50) String mobile,
            @Size(max = 128) String designation,
            @Size(max = 128) String department,
            @Size(max = 255) String linkedinUrl,
            @Size(max = 32) String status,
            String notes) {}
}
