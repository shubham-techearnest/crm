package com.techearnest.crm.procurement.api.dto;

import com.techearnest.crm.filter.FilterNode;
import com.techearnest.crm.procurement.domain.PurchaseOrder;
import com.techearnest.crm.procurement.domain.PurchaseOrderItem;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class PurchaseOrderDtos {

    private PurchaseOrderDtos() {}

    public record PurchaseOrderItemResponse(
            UUID id,
            int lineNo,
            String description,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal amount,
            UUID taxRateId,
            BigDecimal taxAmount,
            BigDecimal receivedQty) {
        public static PurchaseOrderItemResponse from(PurchaseOrderItem item) {
            return new PurchaseOrderItemResponse(
                    item.getId(),
                    item.getLineNo(),
                    item.getDescription(),
                    item.getQuantity(),
                    item.getUnitPrice(),
                    item.getAmount(),
                    item.getTaxRateId(),
                    item.getTaxAmount(),
                    item.getReceivedQty());
        }
    }

    public record PurchaseOrderResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            UUID vendorId,
            UUID projectId,
            UUID requesterId,
            String poNumber,
            String status,
            String currencyCode,
            BigDecimal subtotal,
            BigDecimal taxTotal,
            BigDecimal total,
            LocalDate neededBy,
            Instant approvedAt,
            UUID approvedBy,
            String notes,
            List<PurchaseOrderItemResponse> items,
            Instant createdAt,
            Instant updatedAt) {
        public static PurchaseOrderResponse from(PurchaseOrder po, List<PurchaseOrderItem> items) {
            return new PurchaseOrderResponse(
                    po.getId(),
                    po.getOrganizationId(),
                    po.getRegionId(),
                    po.getVendorId(),
                    po.getProjectId(),
                    po.getRequesterId(),
                    po.getPoNumber(),
                    po.getStatus(),
                    po.getCurrencyCode(),
                    po.getSubtotal(),
                    po.getTaxTotal(),
                    po.getTotal(),
                    po.getNeededBy(),
                    po.getApprovedAt(),
                    po.getApprovedBy(),
                    po.getNotes(),
                    items.stream().map(PurchaseOrderItemResponse::from).toList(),
                    po.getCreatedAt(),
                    po.getUpdatedAt());
        }

        public static PurchaseOrderResponse summary(PurchaseOrder po) {
            return from(po, List.of());
        }
    }

    public record CreatePurchaseOrderRequest(
            UUID organizationId,
            @NotNull UUID regionId,
            @NotNull UUID vendorId,
            UUID projectId,
            UUID requesterId,
            String poNumber,
            String currencyCode,
            LocalDate neededBy,
            String notes) {}

    public record UpdatePurchaseOrderRequest(
            UUID projectId, String poNumber, String currencyCode, LocalDate neededBy, String notes) {}

    public record AddPurchaseOrderItemRequest(
            @NotBlank @Size(max = 500) String description,
            @NotNull @DecimalMin(value = "0.01", inclusive = true) BigDecimal quantity,
            @NotNull @DecimalMin(value = "0.00", inclusive = true) BigDecimal unitPrice,
            UUID taxRateId) {}

    public record QueryPurchaseOrderRequest(
            FilterNode filter,
            String search,
            String status,
            UUID vendorId,
            UUID projectId,
            UUID organizationId,
            Integer page,
            Integer size) {}

    public record RejectPurchaseOrderRequest(@NotBlank String reason) {}
}
