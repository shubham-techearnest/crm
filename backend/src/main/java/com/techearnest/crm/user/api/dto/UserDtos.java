package com.techearnest.crm.user.api.dto;

import com.techearnest.crm.region.domain.Region;
import com.techearnest.crm.role.domain.Role;
import com.techearnest.crm.user.domain.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class UserDtos {

    private UserDtos() {}

    public record UserResponse(
            UUID id,
            UUID organizationId,
            String email,
            String firstName,
            String lastName,
            String phone,
            String status,
            UUID regionId,
            UUID branchId,
            UUID departmentId,
            UUID teamId,
            UUID managerId,
            List<UUID> roleIds,
            List<String> roleCodes,
            List<UUID> regionIds,
            Instant createdAt,
            String jobTitle,
            String employeeCode,
            String mobile,
            LocalDate dateOfJoining,
            String timezone,
            String locale,
            Instant lastLoginAt,
            Instant updatedAt) {

        public static UserResponse from(User user) {
            List<UUID> roleIds = user.getRoles().stream().map(Role::getId).sorted().toList();
            List<String> roleCodes =
                    user.getRoles().stream().map(Role::getCode).sorted().toList();
            List<UUID> regionIds =
                    user.getAssignedRegions().stream().map(Region::getId).sorted().toList();
            return new UserResponse(
                    user.getId(),
                    user.getOrganizationId(),
                    user.getEmail(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.getPhone(),
                    user.getStatus(),
                    user.getRegionId(),
                    user.getBranchId(),
                    user.getDepartmentId(),
                    user.getTeamId(),
                    user.getManagerId(),
                    roleIds,
                    roleCodes,
                    regionIds,
                    user.getCreatedAt(),
                    user.getJobTitle(),
                    user.getEmployeeCode(),
                    user.getMobile(),
                    user.getDateOfJoining(),
                    user.getTimezone(),
                    user.getLocale(),
                    user.getLastLoginAt(),
                    user.getUpdatedAt());
        }
    }

    public record CreateUserRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName,
            @Size(max = 50) String phone,
            UUID regionId,
            UUID branchId,
            UUID departmentId,
            UUID teamId,
            UUID managerId,
            @Size(max = 32) String status,
            List<UUID> roleIds,
            UUID organizationId,
            @Size(max = 128) String jobTitle,
            @Size(max = 64) String employeeCode,
            @Size(max = 50) String mobile,
            LocalDate dateOfJoining,
            @Size(max = 64) String timezone,
            @Size(max = 16) String locale,
            List<UUID> regionIds) {}

    public record UpdateUserRequest(
            @NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName,
            @Size(max = 50) String phone,
            UUID regionId,
            UUID branchId,
            UUID departmentId,
            UUID teamId,
            UUID managerId,
            @Size(max = 32) String status,
            @Size(max = 128) String jobTitle,
            @Size(max = 64) String employeeCode,
            @Size(max = 50) String mobile,
            LocalDate dateOfJoining,
            @Size(max = 64) String timezone,
            @Size(max = 16) String locale) {}

    public record AssignRolesRequest(@NotNull List<UUID> roleIds) {}

    public record AssignRegionsRequest(@NotNull List<UUID> regionIds) {}
}
