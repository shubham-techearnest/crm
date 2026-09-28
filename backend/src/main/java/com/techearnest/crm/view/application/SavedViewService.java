package com.techearnest.crm.view.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.view.api.dto.SavedViewDtos;
import com.techearnest.crm.view.api.dto.SavedViewDtos.CreateSavedViewRequest;
import com.techearnest.crm.view.api.dto.SavedViewDtos.SavedViewResponse;
import com.techearnest.crm.view.api.dto.SavedViewDtos.UpdateSavedViewRequest;
import com.techearnest.crm.view.domain.SavedView;
import com.techearnest.crm.view.domain.SavedViewRepository;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SavedViewService {

    private static final Set<String> MODULES = Set.of(
            "LEAD",
            "ACCOUNT",
            "CONTACT",
            "DEAL",
            "ACTIVITY",
            "PROJECT",
            "TASK",
            "RESOURCE",
            "TIMESHEET");
    private static final Set<String> VISIBILITIES = Set.of("PRIVATE", "SHARED", "PUBLIC");

    private final SavedViewRepository savedViewRepository;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public SavedViewService(
            SavedViewRepository savedViewRepository,
            TenantAccess tenantAccess,
            AuditService auditService,
            ObjectMapper objectMapper) {
        this.savedViewRepository = savedViewRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<SavedViewResponse> list(String module, UUID organizationId) {
        CurrentUser user = tenantAccess.requirePermission("SAVED_VIEW_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        String mod = normalizeModule(module);
        return savedViewRepository.findVisible(orgId, mod, user.userId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public SavedViewResponse create(CreateSavedViewRequest request) {
        CurrentUser user = tenantAccess.requirePermission("SAVED_VIEW_MANAGE");
        UUID orgId = tenantAccess.resolveOrganizationId(null);
        String module = normalizeModule(request.module());
        String visibility = normalizeVisibility(request.visibility());
        assertCanPublishView(user, visibility);
        SavedView view = SavedView.create(
                orgId,
                user.userId(),
                module,
                request.name().trim(),
                visibility,
                writeJson(request.filter()),
                writeJson(request.columns()),
                writeJson(request.sort()),
                Boolean.TRUE.equals(request.isDefault()));
        savedViewRepository.save(view);
        auditService.record(orgId, user.userId(), "CREATE", "SAVED_VIEW", view.getId());
        return toResponse(view);
    }

    @Transactional
    public SavedViewResponse update(UUID id, UpdateSavedViewRequest request) {
        CurrentUser user = tenantAccess.requirePermission("SAVED_VIEW_MANAGE");
        SavedView view = requireOwned(id, user);
        String visibility = request.visibility() == null ? view.getVisibility() : normalizeVisibility(request.visibility());
        assertCanPublishView(user, visibility);
        view.update(
                request.name(),
                visibility,
                request.filter() == null ? null : writeJson(request.filter()),
                request.columns() == null ? null : writeJson(request.columns()),
                request.sort() == null ? null : writeJson(request.sort()),
                request.isDefault());
        auditService.record(view.getOrganizationId(), user.userId(), "UPDATE", "SAVED_VIEW", view.getId());
        return toResponse(view);
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("SAVED_VIEW_MANAGE");
        SavedView view = requireOwned(id, user);
        view.softDelete();
        auditService.record(view.getOrganizationId(), user.userId(), "DELETE", "SAVED_VIEW", view.getId());
    }

    private SavedView requireOwned(UUID id, CurrentUser user) {
        SavedView view = savedViewRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        tenantAccess.assertOrganizationVisible(view.getOrganizationId());
        if (!view.getOwnerId().equals(user.userId())
                && user.dataScope() != com.techearnest.crm.common.security.DataScope.ORGANIZATION
                && user.dataScope() != com.techearnest.crm.common.security.DataScope.PLATFORM) {
            throw new ResourceNotFoundException("Resource not found");
        }
        return view;
    }

    private SavedViewResponse toResponse(SavedView view) {
        return SavedViewDtos.toResponse(
                view, readJson(view.getFilterJson()), readJson(view.getColumnsJson()), readJson(view.getSortJson()));
    }

    private String writeJson(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new BusinessException("INVALID_JSON", "Invalid saved view JSON");
        }
    }

    private JsonNode readJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(raw);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private static String normalizeModule(String module) {
        if (module == null || module.isBlank()) {
            throw new BusinessException("MODULE_REQUIRED", "module is required");
        }
        String mod = module.trim().toUpperCase(Locale.ROOT);
        if (!MODULES.contains(mod)) {
            throw new BusinessException("UNSUPPORTED_MODULE", "Unsupported module: " + module);
        }
        return mod;
    }

    private static String normalizeVisibility(String visibility) {
        if (visibility == null || visibility.isBlank()) {
            return "PRIVATE";
        }
        String vis = visibility.trim().toUpperCase(Locale.ROOT);
        if (!VISIBILITIES.contains(vis)) {
            throw new BusinessException("INVALID_VISIBILITY", "visibility must be PRIVATE, SHARED, or PUBLIC");
        }
        return vis;
    }

    private static void assertCanPublishView(CurrentUser user, String visibility) {
        if ("PRIVATE".equals(visibility)) {
            return;
        }
        if (!user.hasPermission("ORG_UPDATE")) {
            throw new ForbiddenException("You do not have permission to perform this action");
        }
    }
}
