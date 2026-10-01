package com.techearnest.crm.region.api.dto;

import com.techearnest.crm.region.domain.Region;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class RegionDtos {

    private RegionDtos() {}

    public record RegionResponse(
            UUID id,
            UUID organizationId,
            UUID parentId,
            String name,
            String code,
            String status,
            Instant createdAt,
            Instant updatedAt,
            String description,
            UUID managerId,
            String timezone,
            String currencyCode) {

        public static RegionResponse from(Region region) {
            return new RegionResponse(
                    region.getId(),
                    region.getOrganizationId(),
                    region.getParentId(),
                    region.getName(),
                    region.getCode(),
                    region.getStatus(),
                    region.getCreatedAt(),
                    region.getUpdatedAt(),
                    region.getDescription(),
                    region.getManagerId(),
                    region.getTimezone(),
                    region.getCurrencyCode());
        }
    }

    public record CreateRegionRequest(
            @NotBlank @Size(max = 128) String name,
            @NotBlank @Size(max = 32) String code,
            UUID parentId,
            UUID organizationId,
            @Size(max = 2000) String description,
            UUID managerId,
            @Size(max = 64) String timezone,
            @Pattern(regexp = "^$|^[A-Za-z]{3}$", message = "Currency must be a 3-letter code") String currencyCode,
            @Size(max = 32) String status) {}

    public record UpdateRegionRequest(
            @NotBlank @Size(max = 128) String name,
            UUID parentId,
            @Size(max = 32) String status,
            @Size(max = 2000) String description,
            UUID managerId,
            @Size(max = 64) String timezone,
            @Pattern(regexp = "^$|^[A-Za-z]{3}$", message = "Currency must be a 3-letter code") String currencyCode) {}
}
