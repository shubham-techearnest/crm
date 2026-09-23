package com.techearnest.crm.region.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.region.api.dto.RegionDtos.CreateRegionRequest;
import com.techearnest.crm.region.api.dto.RegionDtos.RegionResponse;
import com.techearnest.crm.region.api.dto.RegionDtos.UpdateRegionRequest;
import com.techearnest.crm.region.application.RegionService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/regions")
public class RegionController {

    private final RegionService regionService;

    public RegionController(RegionService regionService) {
        this.regionService = regionService;
    }

    @GetMapping
    public ApiResponse<List<RegionResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result =
                regionService.list(organizationId, search, PageRequest.of(page, Math.min(size, 100), Sort.by("name")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<RegionResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(regionService.get(id));
    }

    @PostMapping
    public ApiResponse<RegionResponse> create(@Valid @RequestBody CreateRegionRequest request) {
        return ApiResponse.ok(regionService.create(request), "Region created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<RegionResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateRegionRequest request) {
        return ApiResponse.ok(regionService.update(id, request), "Region updated successfully");
    }
}
