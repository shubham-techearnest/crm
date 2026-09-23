package com.techearnest.crm.metadata.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.FieldAclResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.UpsertFieldAclRequest;
import com.techearnest.crm.metadata.domain.SysField;
import com.techearnest.crm.metadata.domain.SysFieldAcl;
import com.techearnest.crm.metadata.domain.SysFieldAclRepository;
import com.techearnest.crm.metadata.domain.SysFieldRepository;
import com.techearnest.crm.metadata.domain.SysTable;
import com.techearnest.crm.metadata.domain.SysTableRepository;
import com.techearnest.crm.role.domain.Role;
import com.techearnest.crm.role.domain.RoleRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FieldAclService {

    private static final Set<String> LEVELS = Set.of("HIDDEN", "READ", "WRITE");

    private final SysFieldAclRepository fieldAclRepository;
    private final SysFieldRepository fieldRepository;
    private final SysTableRepository tableRepository;
    private final RoleRepository roleRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final FieldAclEvaluator fieldAclEvaluator;

    public FieldAclService(
            SysFieldAclRepository fieldAclRepository,
            SysFieldRepository fieldRepository,
            SysTableRepository tableRepository,
            RoleRepository roleRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            FieldAclEvaluator fieldAclEvaluator) {
        this.fieldAclRepository = fieldAclRepository;
        this.fieldRepository = fieldRepository;
        this.tableRepository = tableRepository;
        this.roleRepository = roleRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.fieldAclEvaluator = fieldAclEvaluator;
    }

    @Transactional(readOnly = true)
    public List<FieldAclResponse> list(UUID tableId) {
        requireFieldAclView();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        SysTable table = tableRepository
                .findByIdActive(tableId)
                .orElseThrow(() -> new ResourceNotFoundException("Table not found"));
        UUID baseId = table.getOrganizationId() == null
                ? table.getId()
                : tableRepository.findByCodePreferringOrg(orgId, table.getCode()).stream()
                        .filter(t -> t.getOrganizationId() == null)
                        .map(SysTable::getId)
                        .findFirst()
                        .orElse(table.getId());
        Map<UUID, SysField> fields = fieldRepository.findEffectiveForTable(orgId, baseId).stream()
                .collect(Collectors.toMap(SysField::getId, Function.identity(), (a, b) -> a));
        Map<UUID, Role> roles = roleRepository.findVisibleForOrganization(orgId).stream()
                .filter(r -> orgId.equals(r.getOrganizationId()))
                .collect(Collectors.toMap(Role::getId, Function.identity(), (a, b) -> a));
        return fieldAclRepository.findByOrganizationId(orgId).stream()
                .filter(a -> fields.containsKey(a.getFieldId()) && roles.containsKey(a.getRoleId()))
                .sorted(Comparator.comparing((SysFieldAcl a) -> roles.get(a.getRoleId()).getCode())
                        .thenComparing(a -> fields.get(a.getFieldId()).getCode()))
                .map(a -> toResponse(a, roles.get(a.getRoleId()), fields.get(a.getFieldId()), table.getCode()))
                .toList();
    }

    @Transactional
    public FieldAclResponse upsert(UpsertFieldAclRequest request) {
        CurrentUser user = requireFieldAclManage();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        String level = request.accessLevel().trim().toUpperCase(Locale.ROOT);
        if (!LEVELS.contains(level)) {
            throw new BusinessException("INVALID_ACCESS", "accessLevel must be HIDDEN, READ, or WRITE");
        }
        Role role = roleRepository
                .findById(request.roleId())
                .filter(r -> orgId.equals(r.getOrganizationId()))
                .orElseThrow(() -> new ResourceNotFoundException("Role not found"));
        SysField field = fieldRepository
                .findByIdActive(request.fieldId())
                .orElseThrow(() -> new ResourceNotFoundException("Field not found"));
        SysTable table = tableRepository
                .findByIdActive(field.getTableId())
                .orElseThrow(() -> new ResourceNotFoundException("Table not found"));

        SysFieldAcl acl = fieldAclRepository
                .findByOrganizationIdAndRoleIdAndFieldId(orgId, role.getId(), field.getId())
                .orElseGet(() -> SysFieldAcl.create(orgId, role.getId(), field.getId(), level, user.userId()));
        acl.update(level, user.userId());
        fieldAclRepository.save(acl);
        auditService.recordWithSummary(                orgId,
                user.userId(),
                "UPSERT",
                "SYS_FIELD_ACL",
                acl.getId(),
                "{\"role\":\""
                        + role.getCode()
                        + "\",\"table\":\""
                        + table.getCode()
                        + "\",\"field\":\""
                        + field.getCode()
                        + "\",\"accessLevel\":\""
                        + level
                        + "\"}");
        return toResponse(acl, role, field, table.getCode());
    }

    @Transactional(readOnly = true)
    public Map<String, String> meForTable(String tableCode) {
        tenantAccess.currentUser();
        return fieldAclEvaluator.fieldAccessMap(tableCode);
    }

    private FieldAclResponse toResponse(SysFieldAcl acl, Role role, SysField field, String tableCode) {
        return new FieldAclResponse(
                acl.getId(),
                acl.getOrganizationId(),
                acl.getRoleId(),
                acl.getFieldId(),
                tableCode,
                field.getCode(),
                role.getCode(),
                acl.getAccessLevel());
    }

    private CurrentUser requireFieldAclView() {
        CurrentUser user = tenantAccess.requirePermission("FIELD_ACL_VIEW");
        assertTenant(user);
        return user;
    }

    private CurrentUser requireFieldAclManage() {
        CurrentUser user = tenantAccess.requirePermission("FIELD_ACL_MANAGE");
        assertTenant(user);
        return user;
    }

    private static void assertTenant(CurrentUser user) {
        if (user.dataScope() == DataScope.PLATFORM) {
            throw new ForbiddenException("Field ACL is for Organization Admins only");
        }
    }
}
