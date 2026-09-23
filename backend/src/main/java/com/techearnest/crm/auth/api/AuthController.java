package com.techearnest.crm.auth.api;

import com.techearnest.crm.auth.api.dto.LoginRequest;
import com.techearnest.crm.auth.api.dto.MeResponse;
import com.techearnest.crm.auth.api.dto.TokenResponse;
import com.techearnest.crm.auth.application.AuthService;
import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.common.security.AccessGuard;
import com.techearnest.crm.common.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final AccessGuard accessGuard;

    public AuthController(AuthService authService, AccessGuard accessGuard) {
        this.authService = authService;
        this.accessGuard = accessGuard;
    }

    @PostMapping("/login")
    public ApiResponse<TokenResponse> login(
            @Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse response) {
        return ApiResponse.ok(authService.login(request, httpRequest, response), "Signed in successfully");
    }

    @PostMapping("/refresh")
    public ApiResponse<TokenResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        return ApiResponse.ok(authService.refresh(request, response), "Token refreshed");
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        authService.logout(request, response);
        return ApiResponse.ok(null, "Signed out successfully");
    }

    @GetMapping("/me")
    public ApiResponse<MeResponse> me(@AuthenticationPrincipal CurrentUser currentUser) {
        if (currentUser == null) {
            throw new BadCredentialsException("Unauthenticated");
        }
        return ApiResponse.ok(authService.me(currentUser));
    }

    @GetMapping("/platform")
    public ApiResponse<Void> platformOnly() {
        accessGuard.requirePlatform();
        return ApiResponse.ok(null, "Platform access confirmed");
    }
}
