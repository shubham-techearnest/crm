package com.techearnest.crm.branch.api;

import com.techearnest.crm.branch.api.dto.BranchDtos.BranchResponse;
import com.techearnest.crm.branch.api.dto.BranchDtos.CreateBranchRequest;
import com.techearnest.crm.branch.api.dto.BranchDtos.UpdateBranchRequest;
import com.techearnest.crm.branch.application.BranchService;
import com.techearnest.crm.common.api.ApiResponse;
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
@RequestMapping("/api/v1/branches")
public class BranchController {

    private final BranchService branchService;

    public BranchController(BranchService branchService) {
        this.branchService = branchService;
    }

    @GetMapping
    public ApiResponse<List<BranchResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result =
                branchService.list(organizationId, search, PageRequest.of(page, Math.min(size, 100), Sort.by("name")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<BranchResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(branchService.get(id));
    }

    @PostMapping
    public ApiResponse<BranchResponse> create(@Valid @RequestBody CreateBranchRequest request) {
        return ApiResponse.ok(branchService.create(request), "Branch created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<BranchResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateBranchRequest request) {
        return ApiResponse.ok(branchService.update(id, request), "Branch updated successfully");
    }
}
