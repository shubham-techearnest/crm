package com.techearnest.crm.department.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.department.api.dto.DepartmentDtos.CreateDepartmentRequest;
import com.techearnest.crm.department.api.dto.DepartmentDtos.DepartmentResponse;
import com.techearnest.crm.department.api.dto.DepartmentDtos.UpdateDepartmentRequest;
import com.techearnest.crm.department.application.DepartmentService;
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
@RequestMapping("/api/v1/departments")
public class DepartmentController {

    private final DepartmentService departmentService;

    public DepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    @GetMapping
    public ApiResponse<List<DepartmentResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = departmentService.list(
                organizationId, search, PageRequest.of(page, Math.min(size, 100), Sort.by("name")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<DepartmentResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(departmentService.get(id));
    }

    @PostMapping
    public ApiResponse<DepartmentResponse> create(@Valid @RequestBody CreateDepartmentRequest request) {
        return ApiResponse.ok(departmentService.create(request), "Department created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<DepartmentResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateDepartmentRequest request) {
        return ApiResponse.ok(departmentService.update(id, request), "Department updated successfully");
    }
}
