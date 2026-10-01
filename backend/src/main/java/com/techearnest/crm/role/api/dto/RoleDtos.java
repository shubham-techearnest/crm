package com.techearnest.crm.role.api.dto;

import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.permission.domain.Permission;
import com.techearnest.crm.role.domain.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class RoleDtos {

    private RoleDtos() {}

    public record RoleResponse(
            UUID id,
            UUID organizationId,
            String code,
            String name,
            DataScope dataScope,
            boolean system,
            List<String> permissionCodes,
            Instant createdAt,
            Instant updatedAt,
            String description) {

        public static RoleResponse from(Role role) {
            List<String> permissionCodes =
                    role.getPermissions().stream().map(Permission::getCode).sorted().toList();
            return new RoleResponse(
                    role.getId(),
                    role.getOrganizationId(),
                    role.getCode(),
                    role.getName(),
                    role.getDataScope(),
                    role.isSystem(),
                    permissionCodes,
                    role.getCreatedAt(),
                    role.getUpdatedAt(),
                    role.getDescription());
        }
    }

    public record PermissionResponse(UUID id, String code, String module, String description) {

        public static PermissionResponse from(Permission permission) {
            return new PermissionResponse(
                    permission.getId(), permission.getCode(), permission.getModule(), permission.getDescription());
        }
    }

    public record CreateRoleRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 128) String name,
            @NotNull DataScope dataScope,
            List<String> permissionCodes,
            UUID organizationId,
            @Size(max = 2000) String description) {}

    public record UpdateRoleRequest(
            @NotBlank @Size(max = 128) String name,
            DataScope dataScope,
            List<String> permissionCodes,
            @Size(max = 2000) String description) {}
}
