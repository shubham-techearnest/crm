package com.techearnest.crm.branch.api.dto;

import com.techearnest.crm.branch.domain.Branch;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class BranchDtos {

    private BranchDtos() {}

    public record BranchResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            String name,
            String address,
            String status,
            Instant createdAt,
            Instant updatedAt) {

        public static BranchResponse from(Branch branch) {
            return new BranchResponse(
                    branch.getId(),
                    branch.getOrganizationId(),
                    branch.getRegionId(),
                    branch.getName(),
                    branch.getAddress(),
                    branch.getStatus(),
                    branch.getCreatedAt(),
                    branch.getUpdatedAt());
        }
    }

    public record CreateBranchRequest(
            @NotNull UUID regionId,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 500) String address,
            UUID organizationId) {}

    public record UpdateBranchRequest(
            @NotBlank @Size(max = 255) String name,
            @Size(max = 500) String address,
            UUID regionId,
            @Size(max = 32) String status) {}
}
