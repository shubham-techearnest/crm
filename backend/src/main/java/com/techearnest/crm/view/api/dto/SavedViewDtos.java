package com.techearnest.crm.view.api.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.techearnest.crm.view.domain.SavedView;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class SavedViewDtos {

    private SavedViewDtos() {}

    public record SavedViewResponse(
            UUID id,
            UUID organizationId,
            UUID ownerId,
            String module,
            String name,
            String visibility,
            JsonNode filter,
            JsonNode columns,
            JsonNode sort,
            boolean isDefault,
            Instant createdAt,
            Instant updatedAt) {}

    public record CreateSavedViewRequest(
            @NotBlank @Size(max = 32) String module,
            @NotBlank @Size(max = 120) String name,
            @Size(max = 16) String visibility,
            JsonNode filter,
            JsonNode columns,
            JsonNode sort,
            Boolean isDefault) {}

    public record UpdateSavedViewRequest(
            @Size(max = 120) String name,
            @Size(max = 16) String visibility,
            JsonNode filter,
            JsonNode columns,
            JsonNode sort,
            Boolean isDefault) {}

    public static SavedViewResponse toResponse(SavedView view, JsonNode filter, JsonNode columns, JsonNode sort) {
        return new SavedViewResponse(
                view.getId(),
                view.getOrganizationId(),
                view.getOwnerId(),
                view.getModule(),
                view.getName(),
                view.getVisibility(),
                filter,
                columns,
                sort,
                view.isDefault(),
                view.getCreatedAt(),
                view.getUpdatedAt());
    }
}
