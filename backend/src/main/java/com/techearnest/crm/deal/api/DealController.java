package com.techearnest.crm.deal.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.deal.api.dto.DealDtos.CreateDealRequest;
import com.techearnest.crm.deal.api.dto.DealDtos.DealResponse;
import com.techearnest.crm.deal.api.dto.DealDtos.PipelineColumn;
import com.techearnest.crm.deal.api.dto.DealDtos.StageChangeRequest;
import com.techearnest.crm.deal.api.dto.DealDtos.UpdateDealRequest;
import com.techearnest.crm.deal.application.DealService;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateProjectFromDealRequest;
import com.techearnest.crm.project.api.dto.ProjectDtos.ProjectResponse;
import com.techearnest.crm.project.application.ProjectService;
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
@RequestMapping("/api/v1/deals")
public class DealController {

    private final DealService dealService;
    private final ProjectService projectService;

    public DealController(DealService dealService, ProjectService projectService) {
        this.dealService = dealService;
        this.projectService = projectService;
    }

    @GetMapping
    public ApiResponse<List<DealResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) UUID ownerId,
            @RequestParam(required = false) java.math.BigDecimal minValue,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
                    java.time.LocalDate closeFrom,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
                    java.time.LocalDate closeTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = dealService.list(
                organizationId,
                search,
                accountId,
                stage,
                ownerId,
                minValue,
                closeFrom,
                closeTo,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/pipeline")
    public ApiResponse<List<PipelineColumn>> pipeline(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(dealService.pipeline(organizationId));
    }

    @GetMapping("/{id}")
    public ApiResponse<DealResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(dealService.get(id));
    }

    @PostMapping
    public ApiResponse<DealResponse> create(@Valid @RequestBody CreateDealRequest request) {
        return ApiResponse.ok(dealService.create(request), "Deal created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<DealResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateDealRequest request) {
        return ApiResponse.ok(dealService.update(id, request), "Deal updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        dealService.delete(id);
        return ApiResponse.ok(null, "Deal deleted successfully");
    }

    @PostMapping("/{id}/stage")
    public ApiResponse<DealResponse> changeStage(
            @PathVariable UUID id, @Valid @RequestBody StageChangeRequest request) {
        return ApiResponse.ok(dealService.changeStage(id, request), "Deal stage updated successfully");
    }

    @PostMapping("/{id}/create-project")
    public ApiResponse<ProjectResponse> createProject(
            @PathVariable UUID id, @RequestBody(required = false) CreateProjectFromDealRequest request) {
        return ApiResponse.ok(projectService.createFromDeal(id, request), "Project created successfully");
    }
}
