package com.techearnest.crm.metadata.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.TableAclResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.UpsertTableAclRequest;
import com.techearnest.crm.metadata.domain.SysTable;
import com.techearnest.crm.metadata.domain.SysTableAcl;
import com.techearnest.crm.metadata.domain.SysTableAclRepository;
import com.techearnest.crm.metadata.domain.SysTableRepository;
import com.techearnest.crm.role.domain.Role;
import com.techearnest.crm.role.domain.RoleRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TableAclService {

    private final SysTableAclRepository aclRepository;
    private final SysTableRepository tableRepository;
    private final RoleRepository roleRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final TableAclEvaluator tableAclEvaluator;

    public TableAclService(
            SysTableAclRepository aclRepository,
            SysTableRepository tableRepository,
            RoleRepository roleRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            TableAclEvaluator tableAclEvaluator) {
        this.aclRepository = aclRepository;
        this.tableRepository = tableRepository;
        this.roleRepository = roleRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.tableAclEvaluator = tableAclEvaluator;
    }

    @Transactional(readOnly = true)
    public List<TableAclResponse> listMatrix() {
        requireAclView();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        Map<UUID, SysTable> tables = tableRepository.findEffectiveForOrg(orgId).stream()
                .filter(t -> t.getOrganizationId() == null)
                .collect(Collectors.toMap(SysTable::getId, Function.identity(), (a, b) -> a));
        Map<UUID, Role> roles = roleRepository.findVisibleForOrganization(orgId).stream()
                .filter(r -> orgId.equals(r.getOrganizationId()))
                .collect(Collectors.toMap(Role::getId, Function.identity(), (a, b) -> a));
        return aclRepository.findByOrganizationId(orgId).stream()
                .filter(a -> tables.containsKey(a.getTableId()) && roles.containsKey(a.getRoleId()))
                .sorted(Comparator.comparing((SysTableAcl a) -> roles.get(a.getRoleId()).getCode())
                        .thenComparing(a -> tables.get(a.getTableId()).getCode()))
                .map(a -> toResponse(a, roles.get(a.getRoleId()), tables.get(a.getTableId())))
                .toList();
    }

    @Transactional
    public TableAclResponse upsert(UpsertTableAclRequest request) {
        CurrentUser user = requireAclManage();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        Role role = roleRepository
                .findById(request.roleId())
                .filter(r -> orgId.equals(r.getOrganizationId()))
                .orElseThrow(() -> new ResourceNotFoundException("Role not found"));
        SysTable table = tableRepository
                .findByIdActive(request.tableId())
                .orElseThrow(() -> new ResourceNotFoundException("Table not found"));

        if ("ORGANIZATION_ADMIN".equals(role.getCode())
                && (!request.canRead() || !request.canUpdate())) {
            long remainingAdminsWithManage = aclRepository.countByOrganizationIdAndRoleIdAndCanUpdateTrue(
                    orgId, role.getId());
            SysTableAcl existing =
                    aclRepository.findByOrganizationIdAndRoleIdAndTableId(orgId, role.getId(), table.getId())
                            .orElse(null);
            boolean currentlyCanUpdate = existing != null && existing.isCanUpdate();
            if (currentlyCanUpdate && remainingAdminsWithManage <= 1 && table.getCode().equals("role")) {
                throw new BusinessException(
                        "ACL_ESCAPE_HATCH", "Cannot remove last Organization Admin manage rights on Roles");
            }
            if (!request.canRead() && !request.canCreate() && !request.canUpdate() && !request.canDelete()) {
                throw new BusinessException(
                        "ACL_ESCAPE_HATCH", "Cannot strip all CRUD from Organization Admin");
            }
        }

        SysTableAcl acl = aclRepository
                .findByOrganizationIdAndRoleIdAndTableId(orgId, role.getId(), table.getId())
                .orElseGet(() -> SysTableAcl.create(
                        orgId,
                        role.getId(),
                        table.getId(),
                        request.canCreate(),
                        request.canRead(),
                        request.canUpdate(),
                        request.canDelete(),
                        user.userId()));
        acl.update(
                request.canCreate(),
                request.canRead(),
                request.canUpdate(),
                request.canDelete(),
                user.userId());
        aclRepository.save(acl);
        auditService.recordWithSummary(                orgId,
                user.userId(),
                "UPSERT",
                "SYS_TABLE_ACL",
                acl.getId(),
                "{\"role\":\""
                        + role.getCode()
                        + "\",\"table\":\""
                        + table.getCode()
                        + "\",\"create\":"
                        + request.canCreate()
                        + ",\"read\":"
                        + request.canRead()
                        + ",\"update\":"
                        + request.canUpdate()
                        + ",\"delete\":"
                        + request.canDelete()
                        + "}");
        return toResponse(acl, role, table);
    }

    @Transactional(readOnly = true)
    public Map<String, Map<String, Boolean>> meEffective() {
        tenantAccess.currentUser();
        return tableAclEvaluator.effectiveMatrixForCurrentUser();
    }

    private TableAclResponse toResponse(SysTableAcl acl, Role role, SysTable table) {
        return new TableAclResponse(
                acl.getId(),
                acl.getOrganizationId(),
                acl.getRoleId(),
                acl.getTableId(),
                table.getCode(),
                role.getCode(),
                acl.isCanCreate(),
                acl.isCanRead(),
                acl.isCanUpdate(),
                acl.isCanDelete());
    }

    private CurrentUser requireAclView() {
        CurrentUser user = tenantAccess.requirePermission("ACL_VIEW");
        assertTenant(user);
        return user;
    }

    private CurrentUser requireAclManage() {
        CurrentUser user = tenantAccess.requirePermission("ACL_MANAGE");
        assertTenant(user);
        return user;
    }

    private static void assertTenant(CurrentUser user) {
        if (user.dataScope() == DataScope.PLATFORM) {
            throw new ForbiddenException("ACL Studio is for Organization Admins only");
        }
    }
}
