package com.techearnest.crm.procurement.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.procurement.api.dto.VendorDtos.CreateVendorRequest;
import com.techearnest.crm.procurement.api.dto.VendorDtos.QueryVendorRequest;
import com.techearnest.crm.procurement.api.dto.VendorDtos.UpdateVendorRequest;
import com.techearnest.crm.procurement.api.dto.VendorDtos.VendorResponse;
import com.techearnest.crm.procurement.application.VendorService;
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
@RequestMapping("/api/v1/vendors")
public class VendorController {

    private final VendorService vendorService;

    public VendorController(VendorService vendorService) {
        this.vendorService = vendorService;
    }

    @GetMapping
    public ApiResponse<List<VendorResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = vendorService.list(
                organizationId,
                search,
                status,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.ASC, "name")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @PostMapping("/query")
    public ApiResponse<List<VendorResponse>> query(@RequestBody(required = false) QueryVendorRequest request) {
        var result = vendorService.query(request);
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<VendorResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(vendorService.get(id));
    }

    @PostMapping
    public ApiResponse<VendorResponse> create(@Valid @RequestBody CreateVendorRequest request) {
        return ApiResponse.ok(vendorService.create(request), "Vendor created");
    }

    @PutMapping("/{id}")
    public ApiResponse<VendorResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateVendorRequest request) {
        return ApiResponse.ok(vendorService.update(id, request), "Vendor updated");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        vendorService.softDelete(id);
        return ApiResponse.ok(null, "Vendor deleted");
    }
}
