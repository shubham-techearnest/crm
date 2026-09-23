package com.techearnest.crm.user.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.user.api.dto.UserDtos.AssignRegionsRequest;
import com.techearnest.crm.user.api.dto.UserDtos.AssignRolesRequest;
import com.techearnest.crm.user.api.dto.UserDtos.CreateUserRequest;
import com.techearnest.crm.user.api.dto.UserDtos.UpdateUserRequest;
import com.techearnest.crm.user.api.dto.UserDtos.UserResponse;
import com.techearnest.crm.user.application.UserAdminService;
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
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserAdminService userAdminService;

    public UserController(UserAdminService userAdminService) {
        this.userAdminService = userAdminService;
    }

    @GetMapping
    public ApiResponse<List<UserResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = userAdminService.list(
                organizationId, search, PageRequest.of(page, Math.min(size, 100), Sort.by("lastName", "firstName")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<UserResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(userAdminService.get(id));
    }

    @PostMapping
    public ApiResponse<UserResponse> create(@Valid @RequestBody CreateUserRequest request) {
        return ApiResponse.ok(userAdminService.create(request), "User created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<UserResponse> update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request) {
        return ApiResponse.ok(userAdminService.update(id, request), "User updated successfully");
    }

    @PostMapping("/{id}/roles")
    public ApiResponse<UserResponse> assignRoles(
            @PathVariable UUID id, @Valid @RequestBody AssignRolesRequest request) {
        return ApiResponse.ok(userAdminService.assignRoles(id, request), "Roles assigned successfully");
    }

    @PostMapping("/{id}/regions")
    public ApiResponse<UserResponse> assignRegions(
            @PathVariable UUID id, @Valid @RequestBody AssignRegionsRequest request) {
        return ApiResponse.ok(userAdminService.assignRegions(id, request), "Regions assigned successfully");
    }

    @PostMapping("/{id}/deactivate")
    public ApiResponse<UserResponse> deactivate(@PathVariable UUID id) {
        return ApiResponse.ok(userAdminService.deactivate(id), "User deactivated successfully");
    }
}
