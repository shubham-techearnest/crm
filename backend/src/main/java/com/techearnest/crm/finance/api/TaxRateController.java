package com.techearnest.crm.finance.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.finance.api.dto.TaxDtos.CreateTaxRateRequest;
import com.techearnest.crm.finance.api.dto.TaxDtos.TaxRateResponse;
import com.techearnest.crm.finance.api.dto.TaxDtos.UpdateTaxRateRequest;
import com.techearnest.crm.finance.application.TaxRateService;
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
@RequestMapping("/api/v1/tax-rates")
public class TaxRateController {

    private final TaxRateService taxRateService;

    public TaxRateController(TaxRateService taxRateService) {
        this.taxRateService = taxRateService;
    }

    @GetMapping
    public ApiResponse<List<TaxRateResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String taxType,
            @RequestParam(defaultValue = "false") boolean activeOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = taxRateService.list(
                organizationId,
                search,
                taxType,
                activeOnly,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.ASC, "code")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<TaxRateResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(taxRateService.get(id));
    }

    @PostMapping
    public ApiResponse<TaxRateResponse> create(@Valid @RequestBody CreateTaxRateRequest request) {
        return ApiResponse.ok(taxRateService.create(request), "Tax rate created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<TaxRateResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateTaxRateRequest request) {
        return ApiResponse.ok(taxRateService.update(id, request), "Tax rate updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        taxRateService.softDelete(id);
        return ApiResponse.ok(null, "Tax rate deleted successfully");
    }
}
