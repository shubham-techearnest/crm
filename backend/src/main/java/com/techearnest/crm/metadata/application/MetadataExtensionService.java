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
import com.techearnest.crm.metadata.api.dto.MetadataDtos.FormPolicyResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.RelatedListResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SaveFormPolicyRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SaveRelatedListRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.UserListPrefResponse;
import com.techearnest.crm.metadata.domain.SysFormPolicy;
import com.techearnest.crm.metadata.domain.SysFormPolicyRepository;
import com.techearnest.crm.metadata.domain.SysRelatedListLayout;
import com.techearnest.crm.metadata.domain.SysRelatedListLayoutRepository;
import com.techearnest.crm.metadata.domain.SysTable;
import com.techearnest.crm.metadata.domain.SysTableRepository;
import com.techearnest.crm.metadata.domain.SysUserListPref;
import com.techearnest.crm.metadata.domain.SysUserListPrefRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MetadataExtensionService {

    private final SysUserListPrefRepository prefRepository;
    private final SysFormPolicyRepository policyRepository;
    private final SysRelatedListLayoutRepository relatedRepository;
    private final SysTableRepository tableRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public MetadataExtensionService(
            SysUserListPrefRepository prefRepository,
            SysFormPolicyRepository policyRepository,
            SysRelatedListLayoutRepository relatedRepository,
            SysTableRepository tableRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            ObjectMapper objectMapper) {
        this.prefRepository = prefRepository;
        this.policyRepository = policyRepository;
        this.relatedRepository = relatedRepository;
        this.tableRepository = tableRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public UserListPrefResponse getListPref(String tableCode) {
        CurrentUser user = requireTenant();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        return prefRepository
                .findByOrganizationIdAndUserIdAndTableCode(orgId, user.userId(), normalizeCode(tableCode))
                .map(p -> new UserListPrefResponse(p.getTableCode(), readJson(p.getColumnsJson())))
                .orElse(new UserListPrefResponse(normalizeCode(tableCode), objectMapper.createArrayNode()));
    }

    @Transactional
    public UserListPrefResponse saveListPref(String tableCode, JsonNode columns) {
        CurrentUser user = requireTenant();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        String code = normalizeCode(tableCode);
        String json = writeJson(columns);
        SysUserListPref pref = prefRepository
                .findByOrganizationIdAndUserIdAndTableCode(orgId, user.userId(), code)
                .orElseGet(() -> SysUserListPref.create(orgId, user.userId(), code, json));
        pref.updateColumns(json);
        prefRepository.save(pref);
        return new UserListPrefResponse(code, columns);
    }

    @Transactional(readOnly = true)
    public List<FormPolicyResponse> listPolicies(UUID tableId) {
        requireMetadataView();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        return policyRepository.findForTable(orgId, resolveBaseTableId(table)).stream()
                .map(this::toPolicyResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<JsonNode> publishedPolicyNodes(String tableCode, String layoutKey) {
        requireTenant();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        SysTable table = resolveTableByCode(orgId, tableCode);
        return policyRepository
                .findPublished(orgId, resolveBaseTableId(table), layoutKey.toUpperCase(Locale.ROOT))
                .stream()
                .map(p -> readJson(p.getPolicyJson()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FormPolicyResponse> publishedPolicies(String tableCode, String layoutKey) {
        requireTenant();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        SysTable table = resolveTableByCode(orgId, tableCode);
        return policyRepository
                .findPublished(orgId, resolveBaseTableId(table), layoutKey.toUpperCase(Locale.ROOT))
                .stream()
                .map(this::toPolicyResponse)
                .toList();
    }

    @Transactional
    public FormPolicyResponse savePolicy(UUID tableId, SaveFormPolicyRequest request) {
        CurrentUser user = requireMetadataManage();
        SysTable table = requireVisibleTable(tableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID baseId = resolveBaseTableId(table);
        String key = request.layoutKey() == null || request.layoutKey().isBlank()
                ? "EDIT"
                : request.layoutKey().trim().toUpperCase(Locale.ROOT);
        String json = writeJson(request.policy());
        SysFormPolicy policy = SysFormPolicy.createDraft(
                orgId, baseId, key, request.name().trim(), json, user.userId());
        if (request.active() != null) {
            policy.updateDraft(null, null, request.active(), user.userId());
        }
        policyRepository.save(policy);
        auditService.record(orgId, user.userId(), "CREATE", "SYS_FORM_POLICY", policy.getId());
        return toPolicyResponse(policy);
    }

    @Transactional
    public FormPolicyResponse publishPolicy(UUID policyId) {
        CurrentUser user = requireMetadataManage();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        SysFormPolicy policy = policyRepository
                .findByIdAndOrganizationId(policyId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Policy not found"));
        policyRepository.findPublished(orgId, policy.getTableId(), policy.getLayoutKey()).stream()
                .filter(p -> p.getName().equals(policy.getName()) && !p.getId().equals(policy.getId()))
                .forEach(existing -> {
                    existing.markSuperseded(user.userId());
                    policyRepository.save(existing);
                });
        policy.publish(user.userId());
        policyRepository.save(policy);
        auditService.recordWithSummary(                orgId,
                user.userId(),
                "PUBLISH",
                "SYS_FORM_POLICY",
                policy.getId(),
                "{\"name\":\"" + policy.getName() + "\",\"layoutKey\":\"" + policy.getLayoutKey() + "\"}");
        return toPolicyResponse(policy);
    }

    @Transactional(readOnly = true)
    public List<RelatedListResponse> listRelated(UUID parentTableId) {
        requireMetadataView();
        SysTable table = requireVisibleTable(parentTableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        return dedupeRelated(relatedRepository.findForParent(orgId, resolveBaseTableId(table)));
    }

    @Transactional(readOnly = true)
    public List<RelatedListResponse> publishedRelated(String parentTableCode) {
        CurrentUser user = requireTenant();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        SysTable table = resolveTableByCode(orgId, parentTableCode);
        List<SysRelatedListLayout> rows =
                relatedRepository.findPublished(orgId, resolveBaseTableId(table));
        Map<String, SysRelatedListLayout> effective = new LinkedHashMap<>();
        for (SysRelatedListLayout row : rows) {
            if (row.getOrganizationId() == null) {
                effective.putIfAbsent(row.getChildTableCode(), row);
            } else {
                effective.put(row.getChildTableCode(), row);
            }
        }
        return effective.values().stream()
                .filter(r -> r.getPermissionCode() == null || user.hasPermission(r.getPermissionCode()))
                .map(this::toRelatedResponse)
                .toList();
    }

    @Transactional
    public RelatedListResponse saveRelated(UUID parentTableId, SaveRelatedListRequest request) {
        CurrentUser user = requireMetadataManage();
        SysTable table = requireVisibleTable(parentTableId);
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        UUID baseId = resolveBaseTableId(table);
        String child = normalizeCode(request.childTableCode());
        String json = writeJson(request.columns() == null ? objectMapper.createArrayNode() : request.columns());
        SysRelatedListLayout draft = relatedRepository
                .findByOrganizationIdAndParentTableIdAndChildTableCodeAndStatus(orgId, baseId, child, "DRAFT")
                .orElseGet(() -> SysRelatedListLayout.createDraft(
                        orgId,
                        baseId,
                        child,
                        request.label().trim(),
                        request.sortOrder() == null ? 100 : request.sortOrder(),
                        blank(request.permissionCode()),
                        json,
                        user.userId()));
        draft.update(
                request.label(),
                request.sortOrder(),
                blank(request.permissionCode()),
                json,
                request.active(),
                user.userId());
        relatedRepository.save(draft);
        auditService.record(orgId, user.userId(), "SAVE_DRAFT", "SYS_RELATED_LIST", draft.getId());
        return toRelatedResponse(draft);
    }

    @Transactional
    public RelatedListResponse publishRelated(UUID relatedId) {
        CurrentUser user = requireMetadataManage();
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        SysRelatedListLayout draft = relatedRepository
                .findById(relatedId)
                .filter(r -> orgId.equals(r.getOrganizationId()))
                .orElseThrow(() -> new ResourceNotFoundException("Related list not found"));
        relatedRepository
                .findByOrganizationIdAndParentTableIdAndChildTableCodeAndStatus(
                        orgId, draft.getParentTableId(), draft.getChildTableCode(), "PUBLISHED")
                .ifPresent(existing -> {
                    existing.markSuperseded(user.userId());
                    relatedRepository.save(existing);
                });
        draft.publish(user.userId());
        relatedRepository.save(draft);
        auditService.recordWithSummary(                orgId,
                user.userId(),
                "PUBLISH",
                "SYS_RELATED_LIST",
                draft.getId(),
                "{\"childTableCode\":\"" + draft.getChildTableCode() + "\"}");
        return toRelatedResponse(draft);
    }

    private List<RelatedListResponse> dedupeRelated(List<SysRelatedListLayout> rows) {
        Map<String, SysRelatedListLayout> effective = new LinkedHashMap<>();
        for (SysRelatedListLayout row : rows) {
            String key = row.getChildTableCode() + ":" + row.getStatus();
            effective.putIfAbsent(key, row);
        }
        return effective.values().stream().map(this::toRelatedResponse).toList();
    }

    private FormPolicyResponse toPolicyResponse(SysFormPolicy policy) {
        return new FormPolicyResponse(
                policy.getId(),
                policy.getOrganizationId(),
                policy.getTableId(),
                policy.getLayoutKey(),
                policy.getName(),
                policy.getStatus(),
                readJson(policy.getPolicyJson()),
                policy.isActive(),
                policy.getPublishedAt());
    }

    private RelatedListResponse toRelatedResponse(SysRelatedListLayout row) {
        return new RelatedListResponse(
                row.getId(),
                row.getOrganizationId(),
                row.getParentTableId(),
                row.getChildTableCode(),
                row.getLabel(),
                row.getSortOrder(),
                row.getPermissionCode(),
                readJson(row.getColumnsJson()),
                row.getStatus(),
                row.isActive());
    }

    private SysTable resolveTableByCode(UUID orgId, String tableCode) {
        List<SysTable> tables = tableRepository.findByCodePreferringOrg(orgId, normalizeCode(tableCode));
        return tables.stream().findFirst().orElseThrow(() -> new ResourceNotFoundException("Table not found"));
    }

    private UUID resolveBaseTableId(SysTable table) {
        if (table.getOrganizationId() == null) {
            return table.getId();
        }
        return tableRepository.findByCodePreferringOrg(table.getOrganizationId(), table.getCode()).stream()
                .filter(t -> t.getOrganizationId() == null)
                .map(SysTable::getId)
                .findFirst()
                .orElse(table.getId());
    }

    private SysTable requireVisibleTable(UUID id) {
        SysTable table = tableRepository
                .findByIdActive(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        if (table.getOrganizationId() != null && !orgId.equals(table.getOrganizationId())) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return table;
    }

    private CurrentUser requireTenant() {
        CurrentUser user = tenantAccess.currentUser();
        if (user.dataScope() == DataScope.PLATFORM) {
            throw new ForbiddenException("Tenant only");
        }
        return user;
    }

    private CurrentUser requireMetadataView() {
        CurrentUser user = tenantAccess.requirePermission("METADATA_VIEW");
        if (user.dataScope() == DataScope.PLATFORM) {
            throw new ForbiddenException("Metadata Studio is for Organization Admins only");
        }
        return user;
    }

    private CurrentUser requireMetadataManage() {
        CurrentUser user = tenantAccess.requirePermission("METADATA_MANAGE");
        if (user.dataScope() == DataScope.PLATFORM) {
            throw new ForbiddenException("Metadata Studio is for Organization Admins only");
        }
        return user;
    }

    private String writeJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new BusinessException("INVALID_JSON", "Invalid JSON payload");
        }
    }

    private JsonNode readJson(String raw) {
        try {
            return objectMapper.readTree(raw == null || raw.isBlank() ? "[]" : raw);
        } catch (JsonProcessingException e) {
            throw new BusinessException("INVALID_JSON", "Stored JSON is invalid");
        }
    }

    private static String normalizeCode(String code) {
        return code.trim().toLowerCase(Locale.ROOT);
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
