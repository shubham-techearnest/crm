package com.techearnest.crm.platform.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.platform.api.dto.PlatformOrganizationDtos.PlatformOrganizationResponse;
import com.techearnest.crm.platform.api.dto.PlatformOrganizationDtos.ProvisionOrganizationRequest;
import com.techearnest.crm.platform.api.dto.PlatformOrganizationDtos.SetOrganizationStatusRequest;
import com.techearnest.crm.platform.application.PlatformOrganizationService;
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
@RequestMapping("/api/v1/platform/organizations")
public class PlatformOrganizationController {

    private final PlatformOrganizationService platformOrganizationService;

    public PlatformOrganizationController(PlatformOrganizationService platformOrganizationService) {
        this.platformOrganizationService = platformOrganizationService;
    }

    @GetMapping
    public ApiResponse<List<PlatformOrganizationResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = platformOrganizationService.list(
                search, status, PageRequest.of(page, Math.min(size, 100), Sort.by("name")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<PlatformOrganizationResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(platformOrganizationService.get(id));
    }

    @PostMapping
    public ApiResponse<PlatformOrganizationResponse> provision(
            @Valid @RequestBody ProvisionOrganizationRequest request) {
        return ApiResponse.ok(platformOrganizationService.provision(request), "Organization created successfully");
    }

    @PutMapping("/{id}/status")
    public ApiResponse<PlatformOrganizationResponse> setStatus(
            @PathVariable UUID id, @Valid @RequestBody SetOrganizationStatusRequest request) {
        return ApiResponse.ok(
                platformOrganizationService.setStatus(id, request.status()), "Organization status updated");
    }
}
