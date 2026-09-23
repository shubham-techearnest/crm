package com.techearnest.crm.department.api.dto;

import com.techearnest.crm.department.domain.Department;
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
            Instant updatedAt) {

        public static DepartmentResponse from(Department department) {
            return new DepartmentResponse(
                    department.getId(),
                    department.getOrganizationId(),
                    department.getBranchId(),
                    department.getName(),
                    department.getStatus(),
                    department.getCreatedAt(),
                    department.getUpdatedAt());
        }
    }

    public record CreateDepartmentRequest(
            @NotBlank @Size(max = 255) String name, UUID branchId, UUID organizationId) {}

    public record UpdateDepartmentRequest(
            @NotBlank @Size(max = 255) String name, UUID branchId, @Size(max = 32) String status) {}
}
