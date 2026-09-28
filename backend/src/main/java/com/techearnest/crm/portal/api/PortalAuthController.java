package com.techearnest.crm.portal.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.portal.api.dto.PortalAuthDtos.PortalLoginRequest;
import com.techearnest.crm.portal.api.dto.PortalAuthDtos.PortalTokenResponse;
import com.techearnest.crm.portal.application.PortalAuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/portal/auth")
public class PortalAuthController {

    private final PortalAuthService portalAuthService;

    public PortalAuthController(PortalAuthService portalAuthService) {
        this.portalAuthService = portalAuthService;
    }

    @PostMapping("/login")
    public ApiResponse<PortalTokenResponse> login(@Valid @RequestBody PortalLoginRequest request) {
        return ApiResponse.ok(portalAuthService.login(request), "Portal login successful");
    }
}
