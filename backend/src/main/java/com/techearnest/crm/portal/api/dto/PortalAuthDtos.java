package com.techearnest.crm.portal.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public final class PortalAuthDtos {

    private PortalAuthDtos() {}

    public record PortalLoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record PortalTokenResponse(String accessToken, long expiresInSeconds, String audience) {}
}
