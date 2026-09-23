package com.techearnest.crm.region.api.dto;

import com.techearnest.crm.region.domain.Region;
import jakarta.validation.constraints.NotBlank;
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
            Instant updatedAt) {

        public static RegionResponse from(Region region) {
            return new RegionResponse(
                    region.getId(),
                    region.getOrganizationId(),
                    region.getParentId(),
                    region.getName(),
                    region.getCode(),
                    region.getStatus(),
                    region.getCreatedAt(),
                    region.getUpdatedAt());
        }
    }

    public record CreateRegionRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Size(max = 50) String code,
            UUID parentId,
            UUID organizationId) {}

    public record UpdateRegionRequest(
            @NotBlank @Size(max = 255) String name, UUID parentId, @Size(max = 32) String status) {}
}
