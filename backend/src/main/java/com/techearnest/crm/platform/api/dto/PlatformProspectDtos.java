package com.techearnest.crm.platform.api.dto;

import com.techearnest.crm.filter.FilterNode;
import com.techearnest.crm.platform.domain.PlatformProspectOrg;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class PlatformProspectDtos {

    private PlatformProspectDtos() {}

    public record ProspectResponse(
            UUID id,
            String name,
            String legalName,
            String website,
            String email,
            String phone,
            String source,
            String stage,
            BigDecimal estimatedArr,
            UUID ownerUserId,
            String notes,
            UUID linkedOrganizationId,
            Instant createdAt,
            Instant updatedAt) {

        public static ProspectResponse from(PlatformProspectOrg p) {
            return new ProspectResponse(
                    p.getId(),
                    p.getName(),
                    p.getLegalName(),
                    p.getWebsite(),
                    p.getEmail(),
                    p.getPhone(),
                    p.getSource(),
                    p.getStage(),
                    p.getEstimatedArr(),
                    p.getOwnerUserId(),
                    p.getNotes(),
                    p.getLinkedOrganizationId(),
                    p.getCreatedAt(),
                    p.getUpdatedAt());
        }
    }

    public record UpsertProspectRequest(
            @NotBlank @Size(max = 255) String name,
            @Size(max = 255) String legalName,
            @Size(max = 255) String website,
            @Email @Size(max = 255) String email,
            @Size(max = 50) String phone,
            @Size(max = 64) String source,
            @Size(max = 32) String stage,
            BigDecimal estimatedArr,
            UUID ownerUserId,
            String notes) {}

    public record LinkOrganizationRequest(@jakarta.validation.constraints.NotNull UUID organizationId) {}

    public record QueryProspectRequest(String search, FilterNode filter, String stage, String source, int page, int size) {
        public QueryProspectRequest {
            if (page < 0) {
                page = 0;
            }
            if (size <= 0) {
                size = 20;
            }
            if (size > 100) {
                size = 100;
            }
        }
    }
}
