package com.techearnest.crm.metadata.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ConflictException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.CreateFieldRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SysFieldResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SysTableResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.UpdateFieldRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.UpdateTableRequest;
import com.techearnest.crm.metadata.domain.SysField;
import com.techearnest.crm.metadata.domain.SysFieldRepository;
import com.techearnest.crm.metadata.domain.SysTable;
import com.techearnest.crm.metadata.domain.SysTableRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MetadataStudioService {

    public static final int MAX_CUSTOM_FIELDS_PER_TABLE = 50;
    private static final Set<String> FIELD_TYPES =
            Set.of("STRING", "TEXT", "NUMBER", "BOOLEAN", "DATE", "DATETIME", "REFERENCE", "ENUM");

    private final SysTableRepository sysTableRepository;
    private final SysFieldRepository sysFieldRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public MetadataStudioService(
            SysTableRepository sysTableRepository,
            SysFieldRepository sysFieldRepository,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.sysTableRepository = sysTableRepository;
        this.sysFieldRepository = sysFieldRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<SysTableResponse> listTables(UUID organizationId) {
        CurrentUser user = requireTenantMetadataView();
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        Map<String, SysTable> effective = new LinkedHashMap<>();
        for (SysTable table : sysTableRepository.findEffectiveForOrg(orgId)) {
            if (table.getOrganizationId() == null) {
                effective.putIfAbsent(table.getCode(), table);
            } else {
                effective.put(table.getCode(), table);
            }
        }
        return effective.values().stream().map(SysTableResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public SysTableResponse getTable(UUID id) {
        requireTenantMetadataView();
        return SysTableResponse.from(requireVisibleTable(id));
    }

    @Transactional
    public SysTableResponse updateTable(UUID id, UpdateTableRequest request) {
        CurrentUser user = requireTenantMetadataManage();
        SysTable table = requireVisibleTable(id);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        if (table.isSystem() && table.getOrganizationId() == null) {
            if (sysTableRepository.existsByOrganizationIdAndCode(orgId, table.getCode())) {
                throw new ConflictException("Org override already exists for this table");
            }
            SysTable override = SysTable.createOrgOverride(
                    orgId,
                    table.getCode(),
                    request.label() != null ? request.label() : table.getLabel(),
                    request.plural() != null ? request.plural() : table.getPlural(),
                    table.getModuleGroup());
            if (request.active() != null) {
                override.updateLabel(null, null, request.active());
            }
            sysTableRepository.save(override);
            auditService.record(orgId, user.userId(), "CREATE", "SYS_TABLE", override.getId());
            return SysTableResponse.from(override);
        }
        if (table.isSystem() && !orgId.equals(table.getOrganizationId())) {
            throw new ForbiddenException("Cannot mutate another organization's table");
        }
        table.updateLabel(request.label(), request.plural(), request.active());
        auditService.record(orgId, user.userId(), "UPDATE", "SYS_TABLE", table.getId());
        return SysTableResponse.from(table);
    }

    @Transactional
    public void deleteTable(UUID id) {
        CurrentUser user = requireTenantMetadataManage();
        SysTable table = requireVisibleTable(id);
        if (table.isSystem() && table.getOrganizationId() == null) {
            throw new BusinessException("SYSTEM_TABLE", "Cannot delete system tables");
        }
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        if (!orgId.equals(table.getOrganizationId())) {
            throw new ForbiddenException("Cannot delete another organization's table");
        }
        sysTableRepository.delete(table);
        auditService.record(orgId, user.userId(), "DELETE", "SYS_TABLE", id);
    }

    @Transactional(readOnly = true)
    public List<SysFieldResponse> listFields(UUID tableId) {
        requireTenantMetadataView();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID effectiveTableId = resolveBaseTableId(table);
        Map<String, SysField> effective = new LinkedHashMap<>();
        for (SysField field : sysFieldRepository.findEffectiveForTable(orgId, effectiveTableId)) {
            if (field.getOrganizationId() == null) {
                effective.putIfAbsent(field.getCode(), field);
            } else {
                effective.put(field.getCode(), field);
            }
        }
        // Also include org custom fields on override table id
        if (!effectiveTableId.equals(table.getId())) {
            for (SysField field : sysFieldRepository.findEffectiveForTable(orgId, table.getId())) {
                if (field.getOrganizationId() != null) {
                    effective.put(field.getCode(), field);
                }
            }
        }
        return effective.values().stream().map(SysFieldResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public SysFieldResponse getField(UUID id) {
        requireTenantMetadataView();
        return SysFieldResponse.from(requireVisibleField(id));
    }

    @Transactional
    public SysFieldResponse createField(UUID tableId, CreateFieldRequest request) {
        CurrentUser user = requireTenantMetadataManage();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID targetTableId = table.getOrganizationId() == null ? table.getId() : table.getId();
        long customCount = sysFieldRepository.countActiveCustomFields(orgId, targetTableId);
        if (table.getOrganizationId() == null) {
            customCount += sysFieldRepository.countActiveCustomFields(orgId, table.getId());
        }
        if (customCount >= MAX_CUSTOM_FIELDS_PER_TABLE) {
            throw new BusinessException(
                    "CUSTOM_FIELD_LIMIT", "Maximum " + MAX_CUSTOM_FIELDS_PER_TABLE + " custom fields per table");
        }
        String code = request.code().trim();
        if (!code.matches("^[a-z][a-zA-Z0-9_]{1,63}$")) {
            throw new BusinessException("INVALID_CODE", "Field code must be camelCase starting with a letter");
        }
        String type = request.fieldType().trim().toUpperCase(Locale.ROOT);
        if (!FIELD_TYPES.contains(type)) {
            throw new BusinessException("INVALID_TYPE", "Unsupported field type");
        }
        if (sysFieldRepository.existsByOrganizationIdAndTableIdAndCode(orgId, targetTableId, code)) {
            throw new ConflictException("Field code already exists");
        }
        SysField field = SysField.createCustom(
                orgId,
                targetTableId,
                code,
                request.label().trim(),
                blankToNull(request.helpText()),
                type,
                Boolean.TRUE.equals(request.mandatory()),
                blankToNull(request.defaultValue()),
                blankToNull(request.referenceTableCode()),
                request.sortOrder() != null ? request.sortOrder() : 1000,
                user.userId());
        if (Boolean.TRUE.equals(request.filterable())) {
            field.setFilterable(true, user.userId());
        }
        sysFieldRepository.save(field);
        auditService.recordWithSummary(                orgId,
                user.userId(),
                "CREATE",
                "SYS_FIELD",
                field.getId(),
                "{\"code\":\"" + field.getCode() + "\",\"filterable\":" + field.isFilterable() + "}");
        return SysFieldResponse.from(field);
    }

    @Transactional
    public SysFieldResponse updateField(UUID id, UpdateFieldRequest request) {
        CurrentUser user = requireTenantMetadataManage();
        SysField field = requireVisibleField(id);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        if (field.isSystem() && field.getOrganizationId() == null) {
            // Org can only override label/help via a copy — for v1 allow label/help on system via org clone
            SysField clone = SysField.createCustom(
                    orgId,
                    field.getTableId(),
                    field.getCode(),
                    request.label() != null ? request.label() : field.getLabel(),
                    request.helpText() != null ? request.helpText() : field.getHelpText(),
                    field.getFieldType(),
                    field.isMandatory(),
                    field.getDefaultValue(),
                    field.getReferenceTableCode(),
                    field.getSortOrder(),
                    user.userId());
            // Mark as system override of label only — keep system=true semantics via flag
            // Use update path: store as non-system override that shadows by code
            sysFieldRepository.save(clone);
            if (request.filterable() != null) {
                clone.setFilterable(request.filterable(), user.userId());
                sysFieldRepository.save(clone);
            }
            auditService.recordWithSummary(                    orgId,
                    user.userId(),
                    "CREATE",
                    "SYS_FIELD",
                    clone.getId(),
                    "{\"code\":\"" + clone.getCode() + "\",\"filterable\":" + clone.isFilterable() + "}");
            return SysFieldResponse.from(clone);
        }
        if (field.isSystem()) {
            field.updateSystemLabelHelp(request.label(), request.helpText(), user.userId());
            if (request.filterable() != null) {
                field.setFilterable(request.filterable(), user.userId());
            }
        } else {
            if (request.fieldType() != null) {
                String type = request.fieldType().trim().toUpperCase(Locale.ROOT);
                if (!FIELD_TYPES.contains(type)) {
                    throw new BusinessException("INVALID_TYPE", "Unsupported field type");
                }
            }
            field.updateCustom(
                    request.label(),
                    request.helpText(),
                    request.fieldType(),
                    request.mandatory(),
                    request.defaultValue(),
                    request.referenceTableCode(),
                    request.active(),
                    request.filterable(),
                    request.sortOrder(),
                    user.userId());
        }
        auditService.recordWithSummary(                orgId,
                user.userId(),
                "UPDATE",
                "SYS_FIELD",
                field.getId(),
                "{\"code\":\""
                        + field.getCode()
                        + "\",\"filterable\":"
                        + field.isFilterable()
                        + ",\"active\":"
                        + field.isActive()
                        + "}");
        return SysFieldResponse.from(field);
    }

    @Transactional
    public void deactivateField(UUID id) {
        CurrentUser user = requireTenantMetadataManage();
        SysField field = requireVisibleField(id);
        if (field.isSystem() && field.getOrganizationId() == null) {
            throw new BusinessException("SYSTEM_FIELD", "Cannot delete system fields");
        }
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        field.deactivate(user.userId());
        auditService.record(orgId, user.userId(), "DEACTIVATE", "SYS_FIELD", id);
    }

    private UUID resolveBaseTableId(SysTable table) {
        if (table.getOrganizationId() == null) {
            return table.getId();
        }
        return sysTableRepository.findByCodePreferringOrg(table.getOrganizationId(), table.getCode()).stream()
                .filter(t -> t.getOrganizationId() == null)
                .map(SysTable::getId)
                .findFirst()
                .orElse(table.getId());
    }

    private SysTable requireVisibleTable(UUID id) {
        SysTable table = sysTableRepository
                .findByIdActive(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        if (table.getOrganizationId() != null && !orgId.equals(table.getOrganizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return table;
    }

    private SysField requireVisibleField(UUID id) {
        SysField field = sysFieldRepository
                .findByIdActive(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        if (field.getOrganizationId() != null && !orgId.equals(field.getOrganizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return field;
    }

    private CurrentUser requireTenantMetadataView() {
        CurrentUser user = tenantAccess.requirePermission("METADATA_VIEW");
        assertTenantScope(user);
        return user;
    }

    private CurrentUser requireTenantMetadataManage() {
        CurrentUser user = tenantAccess.requirePermission("METADATA_MANAGE");
        assertTenantScope(user);
        return user;
    }

    private static void assertTenantScope(CurrentUser user) {
        if (user.dataScope() == DataScope.PLATFORM) {
            throw new ForbiddenException("Metadata Studio is for Organization Admins only");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
