package com.techearnest.crm.resource.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class ResourcePortalDtos {

    private ResourcePortalDtos() {}

    /**
     * @param email login email; defaults to the resource's email
     * @param accessExpiresOn last day the login works; defaults to the engagement end date (none = no expiry)
     */
    public record PortalInviteRequest(@Email @Size(max = 255) String email, LocalDate accessExpiresOn) {}

    public record PortalAccessRequest(@NotNull LocalDate accessExpiresOn) {}

    public record PortalAccessResponse(
            UUID resourceId,
            UUID userId,
            String email,
            String loginStatus,
            Instant accessExpiresAt,
            String inviteUrl,
            Instant inviteExpiresAt,
            boolean emailed,
            /** False when the linked login is a regular internal user, managed from Users instead. */
            boolean portalManaged) {}

    public record InvitePreview(String email, String name, String organizationName, Instant expiresAt) {}

    public record AcceptInviteRequest(@NotBlank @Size(min = 8, max = 100) String password) {}

    public record AcceptInviteResponse(String email) {}
}
