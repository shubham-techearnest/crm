package com.techearnest.crm.team.api.dto;

import com.techearnest.crm.team.domain.Team;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class TeamDtos {

    private TeamDtos() {}

    public record TeamResponse(
            UUID id,
            UUID organizationId,
            UUID departmentId,
            UUID managerId,
            String name,
            Instant createdAt,
            Instant updatedAt) {

        public static TeamResponse from(Team team) {
            return new TeamResponse(
                    team.getId(),
                    team.getOrganizationId(),
                    team.getDepartmentId(),
                    team.getManagerId(),
                    team.getName(),
                    team.getCreatedAt(),
                    team.getUpdatedAt());
        }
    }

    public record CreateTeamRequest(
            @NotNull UUID departmentId,
            @NotBlank @Size(max = 255) String name,
            UUID managerId,
            UUID organizationId) {}

    public record UpdateTeamRequest(
            @NotBlank @Size(max = 255) String name, UUID departmentId, UUID managerId) {}
}
