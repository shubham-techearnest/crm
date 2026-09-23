package com.techearnest.crm.metadata.application;

import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.domain.SysField;
import com.techearnest.crm.metadata.domain.SysFieldAcl;
import com.techearnest.crm.metadata.domain.SysFieldAclRepository;
import com.techearnest.crm.metadata.domain.SysFieldRepository;
import com.techearnest.crm.metadata.domain.SysTable;
import com.techearnest.crm.metadata.domain.SysTableRepository;
import com.techearnest.crm.role.domain.Role;
import com.techearnest.crm.user.domain.User;
import com.techearnest.crm.user.domain.UserRepository;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class FieldAclEvaluator {

    public enum Access {
        HIDDEN,
        READ,
        WRITE
    }

    private final SysFieldAclRepository fieldAclRepository;
    private final SysFieldRepository fieldRepository;
    private final SysTableRepository tableRepository;
    private final UserRepository userRepository;
    private final TenantAccess tenantAccess;

    public FieldAclEvaluator(
            SysFieldAclRepository fieldAclRepository,
            SysFieldRepository fieldRepository,
            SysTableRepository tableRepository,
            UserRepository userRepository,
            TenantAccess tenantAccess) {
        this.fieldAclRepository = fieldAclRepository;
        this.fieldRepository = fieldRepository;
        this.tableRepository = tableRepository;
        this.userRepository = userRepository;
        this.tenantAccess = tenantAccess;
    }

    /** Most permissive access across user roles for a field code on a table. */
    public Access accessFor(String tableCode, String fieldCode) {
        CurrentUser user = tenantAccess.currentUser();
        if (user.dataScope() == DataScope.PLATFORM) {
            return Access.WRITE;
        }
        UUID orgId = user.organizationId();
        SysTable table = tableRepository.findByCodePreferringOrg(orgId, tableCode.toLowerCase(Locale.ROOT)).stream()
                .filter(t -> t.getOrganizationId() == null)
                .findFirst()
                .orElse(null);
        if (table == null) {
            return legacyRateFallback(user, fieldCode);
        }
        SysField field = fieldRepository.findEffectiveForTable(orgId, table.getId()).stream()
                .filter(f -> f.getCode().equals(fieldCode))
                .findFirst()
                .orElse(null);
        if (field == null) {
            return legacyRateFallback(user, fieldCode);
        }
        Set<UUID> roleIds = loadRoleIds(user.userId());
        if (roleIds.isEmpty()) {
            return legacyRateFallback(user, fieldCode);
        }
        List<SysFieldAcl> acls = fieldAclRepository.findByOrganizationIdAndRoleIdIn(orgId, roleIds).stream()
                .filter(a -> a.getFieldId().equals(field.getId()))
                .toList();
        if (acls.isEmpty()) {
            return legacyRateFallback(user, fieldCode);
        }
        return acls.stream()
                .map(a -> Access.valueOf(a.getAccessLevel()))
                .max(Comparator.comparingInt(this::rank))
                .orElse(Access.HIDDEN);
    }

    public boolean canView(String tableCode, String fieldCode) {
        Access access = accessFor(tableCode, fieldCode);
        return access == Access.READ || access == Access.WRITE;
    }

    public boolean canWrite(String tableCode, String fieldCode) {
        return accessFor(tableCode, fieldCode) == Access.WRITE;
    }

    /** True if user can view any of the typical rate fields on resource. */
    public boolean canViewResourceRates() {
        return canView("resource", "costRate") || canView("resource", "billingRate");
    }

    public boolean canViewAllocationRates() {
        return canView("allocation", "costRate")
                || canView("allocation", "billingRate")
                || canView("allocation", "margin");
    }

    public Map<String, String> fieldAccessMap(String tableCode) {
        CurrentUser user = tenantAccess.currentUser();
        Map<String, String> out = new LinkedHashMap<>();
        if (user.dataScope() == DataScope.PLATFORM || user.organizationId() == null) {
            return out;
        }
        SysTable table = tableRepository
                .findByCodePreferringOrg(user.organizationId(), tableCode.toLowerCase(Locale.ROOT))
                .stream()
                .filter(t -> t.getOrganizationId() == null)
                .findFirst()
                .orElse(null);
        if (table == null) {
            return out;
        }
        for (SysField field : fieldRepository.findEffectiveForTable(user.organizationId(), table.getId())) {
            out.put(field.getCode(), accessFor(tableCode, field.getCode()).name());
        }
        return out;
    }

    private Access legacyRateFallback(CurrentUser user, String fieldCode) {
        if ("costRate".equals(fieldCode)
                || "billingRate".equals(fieldCode)
                || "margin".equals(fieldCode)) {
            return user.hasPermission("RATE_VIEW") ? Access.READ : Access.HIDDEN;
        }
        return Access.WRITE;
    }

    private int rank(Access access) {
        return switch (access) {
            case HIDDEN -> 0;
            case READ -> 1;
            case WRITE -> 2;
        };
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
