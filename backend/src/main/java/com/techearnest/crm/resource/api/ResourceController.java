package com.techearnest.crm.resource.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.CreateResourceRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.DeactivateResourceRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ReactivateResourceRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ResourceLifecycleResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ResourceTypeResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UnavailabilityRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UnavailabilityResponse;
import com.techearnest.crm.resource.application.ResourceLifecycleService;
import com.techearnest.crm.resource.api.dto.ResourceDtos.OnboardResourceRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.OnboardResourceResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ReplaceSkillsRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ResourceResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.ResourceSkillResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UpdateResourceRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UtilizationResponse;
import com.techearnest.crm.resource.application.ResourceOnboardingService;
import com.techearnest.crm.resource.application.ResourceService;
import com.techearnest.crm.resource.application.UtilizationService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
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
@RequestMapping("/api/v1/resources")
public class ResourceController {

    private final ResourceService resourceService;
    private final UtilizationService utilizationService;
    private final ResourceOnboardingService onboardingService;
    private final ResourceLifecycleService lifecycleService;

    public ResourceController(
            ResourceService resourceService,
            UtilizationService utilizationService,
            ResourceOnboardingService onboardingService,
            ResourceLifecycleService lifecycleService) {
        this.resourceService = resourceService;
        this.utilizationService = utilizationService;
        this.onboardingService = onboardingService;
        this.lifecycleService = lifecycleService;
    }

    @GetMapping
    public ApiResponse<List<ResourceResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) UUID skillId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = resourceService.list(
                organizationId,
                search,
                status,
                regionId,
                skillId,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<ResourceResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(resourceService.get(id));
    }

    @PostMapping
    public ApiResponse<ResourceResponse> create(@Valid @RequestBody CreateResourceRequest request) {
        return ApiResponse.ok(resourceService.create(request), "Resource created successfully");
    }

    @PostMapping("/onboard")
    public ApiResponse<OnboardResourceResponse> onboard(@Valid @RequestBody OnboardResourceRequest request) {
        return ApiResponse.ok(onboardingService.onboard(request), "Resource created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<ResourceResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateResourceRequest request) {
        return ApiResponse.ok(resourceService.update(id, request), "Resource updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        resourceService.softDelete(id);
        return ApiResponse.ok(null, "Resource deleted successfully");
    }

    @GetMapping("/{id}/skills")
    public ApiResponse<List<ResourceSkillResponse>> listSkills(@PathVariable UUID id) {
        return ApiResponse.ok(resourceService.listSkills(id));
    }

    @PutMapping("/{id}/skills")
    public ApiResponse<List<ResourceSkillResponse>> putSkills(
            @PathVariable UUID id, @Valid @RequestBody ReplaceSkillsRequest request) {
        return ApiResponse.ok(resourceService.putSkills(id, request), "Resource skills updated successfully");
    }

    @GetMapping("/types")
    public ApiResponse<List<ResourceTypeResponse>> types() {
        return ApiResponse.ok(resourceService.listTypes());
    }

    @PostMapping("/{id}/deactivate")
    public ApiResponse<ResourceLifecycleResponse> deactivate(
            @PathVariable UUID id, @Valid @RequestBody(required = false) DeactivateResourceRequest request) {
        return ApiResponse.ok(lifecycleService.deactivate(id, request), "Resource deactivated");
    }

    @PostMapping("/{id}/reactivate")
    public ApiResponse<ResourceLifecycleResponse> reactivate(
            @PathVariable UUID id, @Valid @RequestBody(required = false) ReactivateResourceRequest request) {
        return ApiResponse.ok(lifecycleService.reactivate(id, request), "Resource reactivated");
    }

    @GetMapping("/{id}/unavailability")
    public ApiResponse<List<UnavailabilityResponse>> listUnavailability(@PathVariable UUID id) {
        return ApiResponse.ok(lifecycleService.listUnavailability(id));
    }

    @PostMapping("/{id}/unavailability")
    public ApiResponse<UnavailabilityResponse> addUnavailability(
            @PathVariable UUID id, @Valid @RequestBody UnavailabilityRequest request) {
        return ApiResponse.ok(lifecycleService.addUnavailability(id, request), "Leave recorded");
    }

    @DeleteMapping("/unavailability/{leaveId}")
    public ApiResponse<Void> removeUnavailability(@PathVariable UUID leaveId) {
        lifecycleService.removeUnavailability(leaveId);
        return ApiResponse.ok(null, "Leave removed");
    }

    @GetMapping("/{id}/utilization")
    public ApiResponse<UtilizationResponse> utilization(
            @PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodEnd) {
        return ApiResponse.ok(utilizationService.getUtilization(id, periodStart, periodEnd));
    }
}
