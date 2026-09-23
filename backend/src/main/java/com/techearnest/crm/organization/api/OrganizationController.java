package com.techearnest.crm.organization.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.organization.api.dto.OrganizationDtos.CreateOrganizationRequest;
import com.techearnest.crm.organization.api.dto.OrganizationDtos.OrganizationResponse;
import com.techearnest.crm.organization.api.dto.OrganizationDtos.UpdateOrganizationRequest;
import com.techearnest.crm.organization.application.OrganizationService;
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
@RequestMapping("/api/v1/organizations")
public class OrganizationController {

    private final OrganizationService organizationService;

    public OrganizationController(OrganizationService organizationService) {
        this.organizationService = organizationService;
    }

    @GetMapping
    public ApiResponse<List<OrganizationResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = organizationService.list(search, PageRequest.of(page, Math.min(size, 100), Sort.by("name")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<OrganizationResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(organizationService.get(id));
    }

    @PostMapping
    public ApiResponse<OrganizationResponse> create(@Valid @RequestBody CreateOrganizationRequest request) {
        return ApiResponse.ok(organizationService.create(request), "Organization created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<OrganizationResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateOrganizationRequest request) {
        return ApiResponse.ok(organizationService.update(id, request), "Organization updated successfully");
    }
}
