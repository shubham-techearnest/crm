package com.techearnest.crm.resource.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.AllocationResponse;
import com.techearnest.crm.resource.api.dto.ResourceDtos.CreateAllocationRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.EndAllocationRequest;
import com.techearnest.crm.resource.api.dto.ResourceDtos.UpdateAllocationRequest;
import com.techearnest.crm.resource.application.AllocationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/allocations")
public class AllocationController {

    private final AllocationService allocationService;

    public AllocationController(AllocationService allocationService) {
        this.allocationService = allocationService;
    }

    @GetMapping
    public ApiResponse<List<AllocationResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) UUID resourceId,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "false") boolean overlapOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = allocationService.list(
                organizationId,
                resourceId,
                projectId,
                status,
                overlapOnly,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<AllocationResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(allocationService.get(id));
    }

    @PostMapping
    public ApiResponse<AllocationResponse> create(@Valid @RequestBody CreateAllocationRequest request) {
        var result = allocationService.create(request);
        return ApiResponse.ok(result.data(), result.message());
    }

    @PutMapping("/{id}")
    public ApiResponse<AllocationResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateAllocationRequest request) {
        var result = allocationService.update(id, request);
        return ApiResponse.ok(result.data(), result.message());
    }

    @PostMapping("/{id}/end")
    public ApiResponse<AllocationResponse> end(
            @PathVariable UUID id, @Valid @RequestBody(required = false) EndAllocationRequest request) {
        var result = allocationService.end(id, request);
        return ApiResponse.ok(result.data(), result.message());
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        allocationService.delete(id);
        return ApiResponse.ok(null, "Allocation deleted successfully");
    }
}
