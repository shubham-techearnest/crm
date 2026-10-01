package com.techearnest.crm.department.api.dto;

import com.techearnest.crm.department.domain.Department;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class DepartmentDtos {

    private DepartmentDtos() {}

    public record DepartmentResponse(
            UUID id,
            UUID organizationId,
            UUID branchId,
            String name,
            String status,
            Instant createdAt,
            Instant updatedAt,
            String code,
            String description,
            UUID headId,
            String email) {

        public static DepartmentResponse from(Department department) {
            return new DepartmentResponse(
                    department.getId(),
                    department.getOrganizationId(),
                    department.getBranchId(),
                    department.getName(),
                    department.getStatus(),
                    department.getCreatedAt(),
                    department.getUpdatedAt(),
                    department.getCode(),
                    department.getDescription(),
                    department.getHeadId(),
                    department.getEmail());
        }
    }

    public record CreateDepartmentRequest(
            @NotBlank @Size(max = 128) String name,
            UUID branchId,
            UUID organizationId,
            @Size(max = 32) String code,
            @Size(max = 2000) String description,
            UUID headId,
            @Email @Size(max = 255) String email,
            @Size(max = 32) String status) {}

    public record UpdateDepartmentRequest(
            @NotBlank @Size(max = 128) String name,
            UUID branchId,
            @Size(max = 32) String status,
            @Size(max = 32) String code,
            @Size(max = 2000) String description,
            UUID headId,
            @Email @Size(max = 255) String email) {}
}
