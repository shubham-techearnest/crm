package com.techearnest.crm.role.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.role.api.dto.RoleDtos.CreateRoleRequest;
import com.techearnest.crm.role.api.dto.RoleDtos.PermissionResponse;
import com.techearnest.crm.role.api.dto.RoleDtos.RoleResponse;
import com.techearnest.crm.role.api.dto.RoleDtos.UpdateRoleRequest;
import com.techearnest.crm.role.application.RoleService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping("/roles")
    public ApiResponse<List<RoleResponse>> list(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(roleService.list(organizationId));
    }

    @GetMapping("/roles/{id}")
    public ApiResponse<RoleResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(roleService.get(id));
    }

    @PostMapping("/roles")
    public ApiResponse<RoleResponse> create(@Valid @RequestBody CreateRoleRequest request) {
        return ApiResponse.ok(roleService.create(request), "Role created successfully");
    }

    @PutMapping("/roles/{id}")
    public ApiResponse<RoleResponse> update(@PathVariable UUID id, @Valid @RequestBody UpdateRoleRequest request) {
        return ApiResponse.ok(roleService.update(id, request), "Role updated successfully");
    }

    @GetMapping("/permissions")
    public ApiResponse<List<PermissionResponse>> listPermissions() {
        return ApiResponse.ok(roleService.listPermissions());
    }
}
