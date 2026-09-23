package com.techearnest.crm.metadata.application;

import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.domain.SysTable;
import com.techearnest.crm.metadata.domain.SysTableAcl;
import com.techearnest.crm.metadata.domain.SysTableAclRepository;
import com.techearnest.crm.metadata.domain.SysTableRepository;
import com.techearnest.crm.role.domain.Role;
import com.techearnest.crm.user.domain.User;
import com.techearnest.crm.user.domain.UserRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class TableAclEvaluator {

    public enum CrudOp {
        CREATE,
        READ,
        UPDATE,
        DELETE
    }

    private static final Map<String, Map<CrudOp, String>> LEGACY = Map.of(
            "lead",
            Map.of(
                    CrudOp.CREATE, "LEAD_CREATE",
                    CrudOp.READ, "LEAD_VIEW",
                    CrudOp.UPDATE, "LEAD_UPDATE",
                    CrudOp.DELETE, "LEAD_DELETE"),
            "contact",
            Map.of(
                    CrudOp.CREATE, "CONTACT_CREATE",
                    CrudOp.READ, "CONTACT_VIEW",
                    CrudOp.UPDATE, "CONTACT_UPDATE",
                    CrudOp.DELETE, "CONTACT_DELETE"),
            "account",
            Map.of(
                    CrudOp.CREATE, "ACCOUNT_CREATE",
                    CrudOp.READ, "ACCOUNT_VIEW",
                    CrudOp.UPDATE, "ACCOUNT_UPDATE",
                    CrudOp.DELETE, "ACCOUNT_DELETE"),
            "deal",
            Map.of(
                    CrudOp.CREATE, "DEAL_CREATE",
                    CrudOp.READ, "DEAL_VIEW",
                    CrudOp.UPDATE, "DEAL_UPDATE",
                    CrudOp.DELETE, "DEAL_DELETE"),
            "activity",
            Map.of(
                    CrudOp.CREATE, "ACTIVITY_CREATE",
                    CrudOp.READ, "ACTIVITY_VIEW",
                    CrudOp.UPDATE, "ACTIVITY_UPDATE",
                    CrudOp.DELETE, "ACTIVITY_DELETE"));

    private final SysTableAclRepository aclRepository;
    private final SysTableRepository tableRepository;
    private final UserRepository userRepository;
    private final TenantAccess tenantAccess;

    public TableAclEvaluator(
            SysTableAclRepository aclRepository,
            SysTableRepository tableRepository,
            UserRepository userRepository,
            TenantAccess tenantAccess) {
        this.aclRepository = aclRepository;
        this.tableRepository = tableRepository;
        this.userRepository = userRepository;
        this.tenantAccess = tenantAccess;
    }

    public CurrentUser requireTableAccess(String tableCode, CrudOp op) {
        CurrentUser user = tenantAccess.currentUser();
        if (user.dataScope() == DataScope.PLATFORM) {
            throw new ForbiddenException("Table ACL applies to tenant users only");
        }
        if (!isAllowed(user, tableCode, op)) {
            throw new ForbiddenException("You do not have permission to perform this action");
        }
        return user;
    }

    public boolean isAllowed(CurrentUser user, String tableCode, CrudOp op) {
        String code = tableCode.trim().toLowerCase(Locale.ROOT);
        Optional<SysTable> table = tableRepository.findByCodePreferringOrg(user.organizationId(), code).stream()
                .filter(t -> t.getOrganizationId() == null)
                .findFirst();
        if (table.isEmpty()) {
            return legacyAllowed(user, code, op);
        }
        Set<UUID> roleIds = loadRoleIds(user.userId());
        if (roleIds.isEmpty()) {
            return legacyAllowed(user, code, op);
        }
        List<SysTableAcl> acls = roleIds.stream()
                .map(roleId ->
                        aclRepository.findByOrganizationIdAndRoleIdAndTableId(
                                user.organizationId(), roleId, table.get().getId()))
                .flatMap(Optional::stream)
                .toList();
        if (acls.isEmpty()) {
            return legacyAllowed(user, code, op);
        }
        return switch (op) {
            case CREATE -> acls.stream().anyMatch(SysTableAcl::isCanCreate);
            case READ -> acls.stream().anyMatch(SysTableAcl::isCanRead);
            case UPDATE -> acls.stream().anyMatch(SysTableAcl::isCanUpdate);
            case DELETE -> acls.stream().anyMatch(SysTableAcl::isCanDelete);
        };
    }

    public Map<String, Map<String, Boolean>> effectiveMatrixForCurrentUser() {
        CurrentUser user = tenantAccess.currentUser();
        Map<String, Map<String, Boolean>> out = new HashMap<>();
        List<String> codes = tableRepository.findEffectiveForOrg(user.organizationId()).stream()
                .filter(t -> t.getOrganizationId() == null)
                .map(SysTable::getCode)
                .distinct()
                .toList();
        for (String table : codes) {
            Map<String, Boolean> ops = new HashMap<>();
            for (CrudOp op : CrudOp.values()) {
                ops.put(op.name().toLowerCase(Locale.ROOT), isAllowed(user, table, op));
            }
            out.put(table, ops);
        }
        return out;
    }

    private boolean legacyAllowed(CurrentUser user, String tableCode, CrudOp op) {
        Map<CrudOp, String> map = LEGACY.get(tableCode);
        if (map == null) {
            return user.hasPermission("METADATA_MANAGE") || user.hasPermission("ACL_MANAGE");
        }
        String permission = map.get(op);
        return permission != null && user.hasPermission(permission);
    }

    private Set<UUID> loadRoleIds(UUID userId) {
        return userRepository
                .findActiveDetailsById(userId)
                .map(User::getRoles)
                .orElse(Set.of())
                .stream()
                .map(Role::getId)
                .collect(Collectors.toSet());
    }
}
