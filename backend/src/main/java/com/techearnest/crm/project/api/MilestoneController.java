package com.techearnest.crm.project.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.MilestoneResponse;
import com.techearnest.crm.project.api.dto.ProjectDtos.UpdateMilestoneRequest;
import com.techearnest.crm.project.application.MilestoneService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/milestones")
public class MilestoneController {

    private final MilestoneService milestoneService;

    public MilestoneController(MilestoneService milestoneService) {
        this.milestoneService = milestoneService;
    }

    @GetMapping
    public ApiResponse<List<MilestoneResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    java.time.LocalDate dueFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    java.time.LocalDate dueTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = milestoneService.list(
                organizationId,
                projectId,
                status,
                dueFrom,
                dueTo,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.ASC, "dueDate")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<MilestoneResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(milestoneService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<MilestoneResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateMilestoneRequest request) {
        return ApiResponse.ok(milestoneService.update(id, request), "Milestone updated successfully");
    }
}
