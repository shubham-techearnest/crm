package com.techearnest.crm.metadata.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.FormLayoutResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.ListLayoutResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.RuntimeFormBundleResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SaveFormLayoutRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SaveListLayoutRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SysFieldResponse;
import com.techearnest.crm.metadata.domain.SysField;
import com.techearnest.crm.metadata.domain.SysFieldRepository;
import com.techearnest.crm.metadata.domain.SysFormLayout;
import com.techearnest.crm.metadata.domain.SysFormLayoutRepository;
import com.techearnest.crm.metadata.domain.SysListLayout;
import com.techearnest.crm.metadata.domain.SysListLayoutRepository;
import com.techearnest.crm.metadata.domain.SysTable;
import com.techearnest.crm.metadata.domain.SysTableRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MetadataLayoutService {

    private final SysTableRepository sysTableRepository;
    private final SysFieldRepository sysFieldRepository;
    private final SysFormLayoutRepository formLayoutRepository;
    private final SysListLayoutRepository listLayoutRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public MetadataLayoutService(
            SysTableRepository sysTableRepository,
            SysFieldRepository sysFieldRepository,
            SysFormLayoutRepository formLayoutRepository,
            SysListLayoutRepository listLayoutRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            ObjectMapper objectMapper) {
        this.sysTableRepository = sysTableRepository;
        this.sysFieldRepository = sysFieldRepository;
        this.formLayoutRepository = formLayoutRepository;
        this.listLayoutRepository = listLayoutRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public FormLayoutResponse getFormLayout(UUID tableId, String layoutKey) {
        requireTenantMetadataView();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        String key = normalizeKey(layoutKey);
        UUID baseTableId = resolveBaseTableId(table);
        Optional<SysFormLayout> draft = formLayoutRepository.findOrgDraft(orgId, baseTableId, key);
        if (draft.isPresent()) {
            return toFormResponse(draft.get());
        }
        return resolvePublishedForm(orgId, baseTableId, key)
                .map(this::toFormResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Form layout not found"));
    }

    @Transactional(readOnly = true)
    public FormLayoutResponse getPublishedFormLayoutByCode(String tableCode, String layoutKey) {
        requireTenantUser();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        SysTable table = resolveTableByCode(orgId, tableCode);
        UUID baseTableId = resolveBaseTableId(table);
        return resolvePublishedForm(orgId, baseTableId, normalizeKey(layoutKey))
                .map(this::toFormResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Form layout not found"));
    }

    @Transactional(readOnly = true)
    public RuntimeFormBundleResponse getPublishedFormBundle(String tableCode, String layoutKey) {
        requireTenantUser();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        SysTable table = resolveTableByCode(orgId, tableCode);
        UUID baseTableId = resolveBaseTableId(table);
        FormLayoutResponse layout = resolvePublishedForm(orgId, baseTableId, normalizeKey(layoutKey))
                .map(this::toFormResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Form layout not found"));
        Map<String, SysField> effective = new LinkedHashMap<>();
        for (SysField field : sysFieldRepository.findEffectiveForTable(orgId, baseTableId)) {
            if (field.getOrganizationId() == null) {
                effective.putIfAbsent(field.getCode(), field);
            } else {
                effective.put(field.getCode(), field);
            }
        }
        List<SysFieldResponse> fields =
                effective.values().stream().filter(SysField::isActive).map(SysFieldResponse::from).toList();
        return new RuntimeFormBundleResponse(layout, fields);
    }

    @Transactional(readOnly = true)
    public List<com.techearnest.crm.metadata.api.dto.MetadataDtos.FilterFieldCatalogItem> getFilterFieldCatalog(
            String tableCode) {
        requireTenantUser();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        SysTable table = resolveTableByCode(orgId, tableCode);
        UUID baseTableId = resolveBaseTableId(table);
        Map<String, SysField> effective = new LinkedHashMap<>();
        for (SysField field : sysFieldRepository.findEffectiveForTable(orgId, baseTableId)) {
            if (field.getOrganizationId() == null) {
                effective.putIfAbsent(field.getCode(), field);
            } else {
                effective.put(field.getCode(), field);
            }
        }
        return effective.values().stream()
                .filter(SysField::isActive)
                .filter(SysField::isFilterable)
                .map(f -> new com.techearnest.crm.metadata.api.dto.MetadataDtos.FilterFieldCatalogItem(
                        f.getCode(), f.getLabel(), f.getFieldType(), f.getReferenceTableCode()))
                .toList();
    }

    @Transactional
    public FormLayoutResponse saveFormDraft(UUID tableId, SaveFormLayoutRequest request) {
        CurrentUser user = requireTenantMetadataManage();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID baseTableId = resolveBaseTableId(table);
        String key = normalizeKey(request.layoutKey());
        String json = writeJson(request.layout());
        SysFormLayout draft = formLayoutRepository
                .findOrgDraft(orgId, baseTableId, key)
                .orElseGet(() -> SysFormLayout.createDraft(orgId, baseTableId, key, json, user.userId()));
        draft.updateDraft(json, user.userId());
        formLayoutRepository.save(draft);
        auditService.record(orgId, user.userId(), "SAVE_DRAFT", "SYS_FORM_LAYOUT", draft.getId());
        return toFormResponse(draft);
    }

    @Transactional
    public FormLayoutResponse publishFormLayout(UUID tableId, String layoutKey) {
        CurrentUser user = requireTenantMetadataManage();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID baseTableId = resolveBaseTableId(table);
        String key = normalizeKey(layoutKey);
        SysFormLayout draft = formLayoutRepository
                .findOrgDraft(orgId, baseTableId, key)
                .orElseThrow(() -> new BusinessException("NO_DRAFT", "Save a draft before publishing"));
        formLayoutRepository.findOrgPublished(orgId, baseTableId, key).ifPresent(existing -> {
            existing.markSuperseded(user.userId());
            formLayoutRepository.save(existing);
        });
        draft.publish(user.userId());
        formLayoutRepository.save(draft);
        auditService.recordWithSummary(                orgId,
                user.userId(),
                "PUBLISH",
                "SYS_FORM_LAYOUT",
                draft.getId(),
                "{\"tableId\":\""
                        + baseTableId
                        + "\",\"layoutKey\":\""
                        + key
                        + "\",\"version\":"
                        + draft.getVersion()
                        + "}");
        return toFormResponse(draft);
    }

    @Transactional
    public void discardFormDraft(UUID tableId, String layoutKey) {
        CurrentUser user = requireTenantMetadataManage();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID baseTableId = resolveBaseTableId(table);
        formLayoutRepository.findOrgDraft(orgId, baseTableId, normalizeKey(layoutKey)).ifPresent(draft -> {
            formLayoutRepository.delete(draft);
            auditService.record(orgId, user.userId(), "DISCARD_DRAFT", "SYS_FORM_LAYOUT", draft.getId());
        });
    }

    @Transactional(readOnly = true)
    public ListLayoutResponse getListLayout(UUID tableId, UUID roleId) {
        requireTenantMetadataView();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID baseTableId = resolveBaseTableId(table);
        Optional<SysListLayout> draft = listLayoutRepository.findOrgDraft(orgId, baseTableId, roleId);
        if (draft.isPresent()) {
            return toListResponse(draft.get());
        }
        return resolvePublishedList(orgId, baseTableId, roleId)
                .map(this::toListResponse)
                .orElseThrow(() -> new ResourceNotFoundException("List layout not found"));
    }

    @Transactional(readOnly = true)
    public ListLayoutResponse getPublishedListLayoutByCode(String tableCode, UUID roleId) {
        requireTenantUser();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        SysTable table = resolveTableByCode(orgId, tableCode);
        UUID baseTableId = resolveBaseTableId(table);
        Optional<SysListLayout> roleLayout = resolvePublishedList(orgId, baseTableId, roleId);
        if (roleLayout.isPresent()) {
            return toListResponse(roleLayout.get());
        }
        if (roleId != null) {
            return resolvePublishedList(orgId, baseTableId, null)
                    .map(this::toListResponse)
                    .orElseThrow(() -> new ResourceNotFoundException("List layout not found"));
        }
        throw new ResourceNotFoundException("List layout not found");
    }

    @Transactional
    public ListLayoutResponse saveListDraft(UUID tableId, SaveListLayoutRequest request) {
        CurrentUser user = requireTenantMetadataManage();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID baseTableId = resolveBaseTableId(table);
        UUID roleId = request.roleId();
        String json = writeJson(request.layout());
        SysListLayout draft = listLayoutRepository
                .findOrgDraft(orgId, baseTableId, roleId)
                .orElseGet(() -> SysListLayout.createDraft(orgId, baseTableId, roleId, json, user.userId()));
        draft.updateDraft(json, user.userId());
        listLayoutRepository.save(draft);
        auditService.record(orgId, user.userId(), "SAVE_DRAFT", "SYS_LIST_LAYOUT", draft.getId());
        return toListResponse(draft);
    }

    @Transactional
    public ListLayoutResponse publishListLayout(UUID tableId, UUID roleId) {
        CurrentUser user = requireTenantMetadataManage();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID baseTableId = resolveBaseTableId(table);
        SysListLayout draft = listLayoutRepository
                .findOrgDraft(orgId, baseTableId, roleId)
                .orElseThrow(() -> new BusinessException("NO_DRAFT", "Save a draft before publishing"));
        listLayoutRepository.findOrgPublished(orgId, baseTableId, roleId).ifPresent(existing -> {
            existing.markSuperseded(user.userId());
            listLayoutRepository.save(existing);
        });
        draft.publish(user.userId());
        listLayoutRepository.save(draft);
        auditService.recordWithSummary(                orgId,
                user.userId(),
                "PUBLISH",
                "SYS_LIST_LAYOUT",
                draft.getId(),
                "{\"tableId\":\""
                        + baseTableId
                        + "\",\"roleId\":"
                        + (roleId == null ? "null" : "\"" + roleId + "\"")
                        + ",\"version\":"
                        + draft.getVersion()
                        + "}");
        return toListResponse(draft);
    }

    @Transactional
    public void discardListDraft(UUID tableId, UUID roleId) {
        CurrentUser user = requireTenantMetadataManage();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID baseTableId = resolveBaseTableId(table);
        listLayoutRepository.findOrgDraft(orgId, baseTableId, roleId).ifPresent(draft -> {
            listLayoutRepository.delete(draft);
            auditService.record(orgId, user.userId(), "DISCARD_DRAFT", "SYS_LIST_LAYOUT", draft.getId());
        });
    }

    private Optional<SysFormLayout> resolvePublishedForm(UUID orgId, UUID tableId, String key) {
        List<SysFormLayout> published = formLayoutRepository.findPublished(orgId, tableId, key);
        return published.stream().findFirst();
    }

    private Optional<SysListLayout> resolvePublishedList(UUID orgId, UUID tableId, UUID roleId) {
        List<SysListLayout> published = listLayoutRepository.findPublished(orgId, tableId, roleId);
        return published.stream().findFirst();
    }

    private SysTable resolveTableByCode(UUID orgId, String tableCode) {
        List<SysTable> tables = sysTableRepository.findByCodePreferringOrg(orgId, tableCode.trim().toLowerCase(Locale.ROOT));
        if (tables.isEmpty()) {
            // try exact code as seeded
            tables = sysTableRepository.findByCodePreferringOrg(orgId, tableCode.trim());
        }
        return tables.stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Table not found"));
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

    private FormLayoutResponse toFormResponse(SysFormLayout layout) {
        return FormLayoutResponse.from(layout, readJson(layout.getLayoutJson()));
    }

    private ListLayoutResponse toListResponse(SysListLayout layout) {
        return ListLayoutResponse.from(layout, readJson(layout.getLayoutJson()));
    }

    private String writeJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new BusinessException("INVALID_LAYOUT", "Layout JSON is invalid");
        }
    }

    private JsonNode readJson(String raw) {
        try {
            return objectMapper.readTree(raw == null || raw.isBlank() ? "{}" : raw);
        } catch (JsonProcessingException e) {
            throw new BusinessException("INVALID_LAYOUT", "Stored layout JSON is invalid");
        }
    }

    private static String normalizeKey(String layoutKey) {
        String key = layoutKey == null || layoutKey.isBlank() ? "CREATE" : layoutKey.trim().toUpperCase(Locale.ROOT);
        if (!key.equals("CREATE") && !key.equals("EDIT")) {
            throw new BusinessException("INVALID_LAYOUT_KEY", "layoutKey must be CREATE or EDIT");
        }
        return key;
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

    private CurrentUser requireTenantUser() {
        CurrentUser user = tenantAccess.currentUser();
        assertTenantScope(user);
        return user;
    }

    private static void assertTenantScope(CurrentUser user) {
        if (user.dataScope() == DataScope.PLATFORM) {
            throw new ForbiddenException("Metadata Studio is for Organization Admins only");
        }
    }
}
