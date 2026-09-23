package com.techearnest.crm.dashboard.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.dashboard.api.dto.DashboardDtos.DashboardResponse;
import com.techearnest.crm.dashboard.application.DashboardService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboards")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/organization")
    public ApiResponse<DashboardResponse> organization(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(dashboardService.organization(organizationId));
    }

    @GetMapping("/region")
    public ApiResponse<DashboardResponse> region(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) UUID regionId) {
        return ApiResponse.ok(dashboardService.region(organizationId, regionId));
    }

    @GetMapping("/sales")
    public ApiResponse<DashboardResponse> sales(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(dashboardService.sales(organizationId));
    }

    @GetMapping("/project")
    public ApiResponse<DashboardResponse> project(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(dashboardService.project(organizationId));
    }

    @GetMapping("/employee")
    public ApiResponse<DashboardResponse> employee(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(dashboardService.employee(organizationId));
    }
}
