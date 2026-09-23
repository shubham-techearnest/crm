package com.techearnest.crm.procurement.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.AddPurchaseOrderItemRequest;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.CreatePurchaseOrderRequest;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.PurchaseOrderResponse;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.QueryPurchaseOrderRequest;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.UpdatePurchaseOrderRequest;
import com.techearnest.crm.procurement.application.PurchaseOrderService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/purchase-orders")
public class PurchaseOrderController {

    private final PurchaseOrderService purchaseOrderService;

    public PurchaseOrderController(PurchaseOrderService purchaseOrderService) {
        this.purchaseOrderService = purchaseOrderService;
    }

    @GetMapping
    public ApiResponse<List<PurchaseOrderResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID vendorId,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = purchaseOrderService.list(
                organizationId,
                search,
                status,
                vendorId,
                projectId,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @PostMapping("/query")
    public ApiResponse<List<PurchaseOrderResponse>> query(
            @RequestBody(required = false) QueryPurchaseOrderRequest request) {
        var result = purchaseOrderService.query(request);
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<PurchaseOrderResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(purchaseOrderService.get(id));
    }

    @PostMapping
    public ApiResponse<PurchaseOrderResponse> create(@Valid @RequestBody CreatePurchaseOrderRequest request) {
        return ApiResponse.ok(purchaseOrderService.createDraft(request), "Purchase order draft created");
    }

    @PutMapping("/{id}")
    public ApiResponse<PurchaseOrderResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdatePurchaseOrderRequest request) {
        return ApiResponse.ok(purchaseOrderService.update(id, request), "Purchase order updated");
    }

    @PostMapping("/{id}/items")
    public ApiResponse<PurchaseOrderResponse> addItem(
            @PathVariable UUID id, @Valid @RequestBody AddPurchaseOrderItemRequest request) {
        return ApiResponse.ok(purchaseOrderService.addItem(id, request), "Line added");
    }

    @DeleteMapping("/{id}/items/{itemId}")
    public ApiResponse<PurchaseOrderResponse> removeItem(@PathVariable UUID id, @PathVariable UUID itemId) {
        return ApiResponse.ok(purchaseOrderService.removeItem(id, itemId), "Line removed");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        purchaseOrderService.softDelete(id);
        return ApiResponse.ok(null, "Purchase order deleted");
    }
}
