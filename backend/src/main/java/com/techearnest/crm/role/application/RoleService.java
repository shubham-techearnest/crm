package com.techearnest.crm.role.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.permission.domain.Permission;
import com.techearnest.crm.permission.domain.PermissionRepository;
import com.techearnest.crm.role.api.dto.RoleDtos.CreateRoleRequest;
import com.techearnest.crm.role.api.dto.RoleDtos.PermissionResponse;
import com.techearnest.crm.role.api.dto.RoleDtos.RoleResponse;
import com.techearnest.crm.role.api.dto.RoleDtos.UpdateRoleRequest;
import com.techearnest.crm.role.domain.Role;
import com.techearnest.crm.role.domain.RoleRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public RoleService(
            RoleRepository roleRepository,
            PermissionRepository permissionRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> list(UUID organizationId) {
        tenantAccess.requirePermission("ROLE_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        return roleRepository.findVisibleForOrganization(orgId).stream()
                .map(RoleResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public RoleResponse get(UUID id) {
        tenantAccess.requirePermission("ROLE_VIEW");
        return RoleResponse.from(requireVisibleRole(id));
    }

    @Transactional(readOnly = true)
    public List<PermissionResponse> listPermissions() {
        tenantAccess.requirePermission("ROLE_VIEW");
        return permissionRepository.findAllOrdered().stream().map(PermissionResponse::from).toList();
    }

    @Transactional
    public RoleResponse create(CreateRoleRequest request) {
        CurrentUser user = tenantAccess.requirePermission("ROLE_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(request.organizationId());
        if (request.dataScope() == DataScope.PLATFORM) {
            throw new BusinessException("INVALID_SCOPE", "Cannot create platform-scoped roles");
        }
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (roleRepository.existsByOrganizationIdAndCodeIgnoreCaseAndDeletedAtIsNull(orgId, code)) {
            throw new ConflictException("Role code already exists");
        }
        Role role = Role.create(orgId, code, request.name().trim(), request.dataScope());
        role.replacePermissions(resolvePermissions(request.permissionCodes()));
        roleRepository.save(role);
        auditService.record(orgId, user.userId(), "CREATE", "ROLE", role.getId());
        return RoleResponse.from(role);
    }

    @Transactional
    public RoleResponse update(UUID id, UpdateRoleRequest request) {
        CurrentUser user = tenantAccess.requirePermission("ROLE_MANAGE");
        Role role = requireVisibleRole(id);
        if (role.getOrganizationId() == null) {
            throw new ResourceNotFoundException("Resource not found");
        }
        if (role.isSystem()) {
            if (!Objects.equals(request.name(), role.getName())
                    || (request.dataScope() != null && request.dataScope() != role.getDataScope())) {
                throw new BusinessException("SYSTEM_ROLE", "Cannot change name or scope of system roles");
            }
            if (request.permissionCodes() != null) {
                role.replacePermissions(resolvePermissions(request.permissionCodes()));
            }
        } else {
            DataScope scope = request.dataScope() != null ? request.dataScope() : role.getDataScope();
            if (scope == DataScope.PLATFORM) {
                throw new BusinessException("INVALID_SCOPE", "Cannot set platform scope on org roles");
            }
            role.update(request.name().trim(), scope);
            if (request.permissionCodes() != null) {
                role.replacePermissions(resolvePermissions(request.permissionCodes()));
            }
        }
        auditService.record(role.getOrganizationId(), user.userId(), "UPDATE", "ROLE", role.getId());
        return RoleResponse.from(role);
    }

    private Role requireVisibleRole(UUID id) {
        Role role = roleRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        if (role.getOrganizationId() != null) {
            tenantAccess.assertOrganizationVisible(role.getOrganizationId());
        }
        return role;
    }

    private Set<Permission> resolvePermissions(List<String> permissionCodes) {
        if (permissionCodes == null || permissionCodes.isEmpty()) {
            return Set.of();
        }
        List<Permission> permissions = permissionRepository.findByCodeIn(permissionCodes);
        if (permissions.size() != new HashSet<>(permissionCodes).size()) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return new HashSet<>(permissions);
    }
}
