package com.techearnest.crm.organization.module;

import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.organization.module.ModuleCatalog.ModuleDefinition;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Stores which catalog modules an organization may use and strips permissions of disabled ones. */
@Service
public class OrganizationModuleService {

    public record ModuleState(
            String code, String label, String group, String description, boolean enabled, List<String> permissions) {}

    private final JdbcTemplate jdbcTemplate;
    private final Map<UUID, Set<String>> disabledCache = new ConcurrentHashMap<>();

    public OrganizationModuleService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Set<String> disabledModules(UUID organizationId) {
        if (organizationId == null) {
            return Set.of();
        }
        return disabledCache.computeIfAbsent(organizationId, this::loadDisabled);
    }

    public boolean isPermissionAllowed(UUID organizationId, String permission) {
        Set<String> disabled = disabledModules(organizationId);
        if (disabled.isEmpty()) {
            return true;
        }
        return ModuleCatalog.moduleForPermission(permission).map(m -> !disabled.contains(m)).orElse(true);
    }

    public boolean isTableAllowed(UUID organizationId, String tableCode) {
        Set<String> disabled = disabledModules(organizationId);
        if (disabled.isEmpty()) {
            return true;
        }
        return ModuleCatalog.moduleForTable(tableCode).map(m -> !disabled.contains(m)).orElse(true);
    }

    public Set<String> filterPermissions(UUID organizationId, Collection<String> permissions) {
        Set<String> disabled = disabledModules(organizationId);
        if (disabled.isEmpty()) {
            return new LinkedHashSet<>(permissions);
        }
        Set<String> allowed = new LinkedHashSet<>();
        for (String permission : permissions) {
            boolean blocked = ModuleCatalog.moduleForPermission(permission).map(disabled::contains).orElse(false);
            if (!blocked) {
                allowed.add(permission);
            }
        }
        return allowed;
    }

    public List<ModuleState> list(UUID organizationId) {
        Set<String> disabled = disabledModules(organizationId);
        return ModuleCatalog.MODULES.stream()
                .map(m -> toState(m, !disabled.contains(m.code())))
                .toList();
    }

    public static List<ModuleState> catalog() {
        return ModuleCatalog.MODULES.stream().map(m -> toState(m, true)).toList();
    }

    /** Replaces the organization's entitlements: every catalog module not listed is disabled. */
    @Transactional
    public List<ModuleState> replaceEnabled(UUID organizationId, Collection<String> enabledCodes, UUID actorId) {
        Set<String> enabled = new HashSet<>();
        for (String code : enabledCodes) {
            String normalized = code == null ? "" : code.trim().toUpperCase();
            if (ModuleCatalog.find(normalized).isEmpty()) {
                throw new BusinessException("UNKNOWN_MODULE", "Unknown module: " + code);
            }
            enabled.add(normalized);
        }
        for (ModuleDefinition module : ModuleCatalog.MODULES) {
            jdbcTemplate.update(
                    """
                    INSERT INTO organization_modules (organization_id, module_code, enabled, updated_at, updated_by)
                    VALUES (?, ?, ?, NOW(), ?)
                    ON CONFLICT (organization_id, module_code)
                    DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW(), updated_by = EXCLUDED.updated_by
                    """,
                    organizationId,
                    module.code(),
                    enabled.contains(module.code()),
                    actorId);
        }
        evictAfterCommit(organizationId);
        return ModuleCatalog.MODULES.stream()
                .map(m -> toState(m, enabled.contains(m.code())))
                .toList();
    }

    private void evictAfterCommit(UUID organizationId) {
        disabledCache.remove(organizationId);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    disabledCache.remove(organizationId);
                }
            });
        }
    }

    private Set<String> loadDisabled(UUID organizationId) {
        List<String> rows = jdbcTemplate.queryForList(
                "SELECT module_code FROM organization_modules WHERE organization_id = ? AND enabled = FALSE",
                String.class,
                organizationId);
        return Set.copyOf(rows);
    }

    private static ModuleState toState(ModuleDefinition module, boolean enabled) {
        return new ModuleState(
                module.code(),
                module.label(),
                module.group(),
                module.description(),
                enabled,
                module.permissions().stream().sorted().toList());
    }
}
