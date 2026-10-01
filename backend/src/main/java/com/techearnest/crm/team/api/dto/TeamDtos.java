package com.techearnest.crm.team.api.dto;

import com.techearnest.crm.team.domain.Team;
import jakarta.validation.constraints.Email;
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
            Instant updatedAt,
            String description,
            String email,
            String status) {

        public static TeamResponse from(Team team) {
            return new TeamResponse(
                    team.getId(),
                    team.getOrganizationId(),
                    team.getDepartmentId(),
                    team.getManagerId(),
                    team.getName(),
                    team.getCreatedAt(),
                    team.getUpdatedAt(),
                    team.getDescription(),
                    team.getEmail(),
                    team.getStatus());
        }
    }

    public record CreateTeamRequest(
            @NotNull UUID departmentId,
            @NotBlank @Size(max = 128) String name,
            UUID managerId,
            UUID organizationId,
            @Size(max = 2000) String description,
            @Email @Size(max = 255) String email,
            @Size(max = 32) String status) {}

    public record UpdateTeamRequest(
            @NotBlank @Size(max = 128) String name,
            UUID departmentId,
            UUID managerId,
            @Size(max = 2000) String description,
            @Email @Size(max = 255) String email,
            @Size(max = 32) String status) {}
}
