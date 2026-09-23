package com.techearnest.crm.procurement.api.dto;

import com.techearnest.crm.filter.FilterNode;
import com.techearnest.crm.procurement.domain.Vendor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class VendorDtos {

    private VendorDtos() {}

    public record VendorResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            String name,
            String email,
            String phone,
            String taxNumber,
            UUID accountId,
            Integer paymentTermsDays,
            String status,
            String notes,
            Instant createdAt,
            Instant updatedAt) {
        public static VendorResponse from(Vendor vendor) {
            return new VendorResponse(
                    vendor.getId(),
                    vendor.getOrganizationId(),
                    vendor.getRegionId(),
                    vendor.getName(),
                    vendor.getEmail(),
                    vendor.getPhone(),
                    vendor.getTaxNumber(),
                    vendor.getAccountId(),
                    vendor.getPaymentTermsDays(),
                    vendor.getStatus(),
                    vendor.getNotes(),
                    vendor.getCreatedAt(),
                    vendor.getUpdatedAt());
        }
    }

    public record CreateVendorRequest(
            UUID organizationId,
            @NotNull UUID regionId,
            @NotBlank @Size(max = 255) String name,
            @Size(max = 255) String email,
            @Size(max = 64) String phone,
            @Size(max = 64) String taxNumber,
            UUID accountId,
            Integer paymentTermsDays,
            String status,
            String notes) {}

    public record UpdateVendorRequest(
            @Size(max = 255) String name,
            @Size(max = 255) String email,
            @Size(max = 64) String phone,
            @Size(max = 64) String taxNumber,
            UUID accountId,
            Integer paymentTermsDays,
            String status,
            String notes) {}

    public record QueryVendorRequest(
            FilterNode filter,
            String search,
            String status,
            UUID organizationId,
            Integer page,
            Integer size) {}
}
