package com.techearnest.crm.resource.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardAllocation;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardFilter;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardResource;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.BoardSettingsResponse;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.CapacityResponse;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.ResourceBoardResponse;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.ResourceWorkloadResponse;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.UpdateBoardSettingsRequest;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.WorkloadProjectCost;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.WorkloadTask;
import com.techearnest.crm.resource.api.dto.ResourceBoardDtos.WorkloadTimesheet;
import com.techearnest.crm.resource.application.ResourceBoardService;
import com.techearnest.crm.resource.domain.ResourceMetrics;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/resource-board")
public class ResourceBoardController {

    private final ResourceBoardService boardService;

    public ResourceBoardController(ResourceBoardService boardService) {
        this.boardService = boardService;
    }

    @GetMapping
    public ApiResponse<ResourceBoardResponse> board(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodEnd,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<String> resourceType,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) List<UUID> skillId,
            @RequestParam(required = false) BigDecimal minExperienceYears,
            @RequestParam(required = false) Integer availableWithinDays,
            @RequestParam(required = false) BigDecimal maxAllocationPct,
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Boolean billable,
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        BoardFilter filter = new BoardFilter(
                search, resourceType, category, departmentId, regionId, projectId, skillId, minExperienceYears,
                availableWithinDays, maxAllocationPct, status, location, billable, includeInactive);
        return ApiResponse.ok(boardService.board(organizationId, periodStart, periodEnd, filter));
    }

    /** Availability search, e.g. Java, free within 15 days, at most 80% allocated, 5+ years. */
    @GetMapping("/search")
    public ApiResponse<List<BoardResource>> search(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<String> resourceType,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) List<UUID> skillId,
            @RequestParam(required = false) BigDecimal minExperienceYears,
            @RequestParam(required = false) Integer availableWithinDays,
            @RequestParam(required = false) BigDecimal maxAllocationPct,
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Boolean billable) {
        BoardFilter filter = new BoardFilter(
                search, resourceType, category, departmentId, regionId, projectId, skillId, minExperienceYears,
                availableWithinDays, maxAllocationPct, status, location, billable, false);
        return ApiResponse.ok(boardService.search(organizationId, filter));
    }

    @GetMapping("/bench")
    public ApiResponse<List<BoardResource>> bench(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(boardService.byStatus(organizationId, ResourceMetrics.STATUS_BENCH));
    }

    @GetMapping("/available")
    public ApiResponse<List<BoardResource>> available(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(defaultValue = "0") int withinDays,
            @RequestParam(required = false) BigDecimal minCapacityPct) {
        return ApiResponse.ok(boardService.available(organizationId, withinDays, minCapacityPct));
    }

    @GetMapping("/ending-soon")
    public ApiResponse<List<BoardResource>> endingSoon(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(boardService.byStatus(organizationId, ResourceMetrics.STATUS_ENDING_SOON));
    }

    @GetMapping("/overallocated")
    public ApiResponse<List<BoardResource>> overallocated(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(boardService.byStatus(organizationId, ResourceMetrics.STATUS_OVER));
    }

    @GetMapping({"/capacity", "/utilization"})
    public ApiResponse<CapacityResponse> capacity(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodEnd) {
        return ApiResponse.ok(boardService.capacity(organizationId, periodStart, periodEnd));
    }

    @GetMapping("/resources/{id}")
    public ApiResponse<ResourceWorkloadResponse> workload(
            @PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodEnd) {
        return ApiResponse.ok(boardService.workload(id, periodStart, periodEnd));
    }

    @GetMapping("/resources/{id}/projects")
    public ApiResponse<List<BoardAllocation>> projects(@PathVariable UUID id) {
        return ApiResponse.ok(boardService.workload(id, null, null).allocations());
    }

    @GetMapping("/resources/{id}/tasks")
    public ApiResponse<List<WorkloadTask>> tasks(@PathVariable UUID id) {
        return ApiResponse.ok(boardService.workload(id, null, null).tasks());
    }

    @GetMapping("/resources/{id}/timesheets")
    public ApiResponse<List<WorkloadTimesheet>> timesheets(@PathVariable UUID id) {
        return ApiResponse.ok(boardService.workload(id, null, null).timesheets());
    }

    @GetMapping("/resources/{id}/costs")
    public ApiResponse<List<WorkloadProjectCost>> costs(@PathVariable UUID id) {
        return ApiResponse.ok(boardService.workload(id, null, null).costs());
    }

    @GetMapping("/settings")
    public ApiResponse<BoardSettingsResponse> settings(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(boardService.settings(organizationId));
    }

    @PutMapping("/settings")
    public ApiResponse<BoardSettingsResponse> updateSettings(
            @RequestParam(required = false) UUID organizationId,
            @Valid @RequestBody UpdateBoardSettingsRequest request) {
        return ApiResponse.ok(boardService.updateSettings(organizationId, request), "Board settings saved");
    }
}
