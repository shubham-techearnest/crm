package com.techearnest.crm.platform.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.platform.api.dto.PlatformDashboardResponse;
import com.techearnest.crm.platform.application.PlatformDashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform")
public class PlatformDashboardController {

    private final PlatformDashboardService platformDashboardService;

    public PlatformDashboardController(PlatformDashboardService platformDashboardService) {
        this.platformDashboardService = platformDashboardService;
    }

    @GetMapping("/dashboard")
    public ApiResponse<PlatformDashboardResponse> dashboard() {
        return ApiResponse.ok(platformDashboardService.dashboard());
    }
}
