package com.techearnest.crm.metadata.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.FilterFieldCatalogItem;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.FormLayoutResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.ListLayoutResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.RuntimeFormBundleResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SaveFormLayoutRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SaveListLayoutRequest;
import com.techearnest.crm.metadata.application.MetadataLayoutService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/metadata")
public class MetadataLayoutController {

    private final MetadataLayoutService metadataLayoutService;

    public MetadataLayoutController(MetadataLayoutService metadataLayoutService) {
        this.metadataLayoutService = metadataLayoutService;
    }

    @GetMapping("/tables/{tableId}/form-layouts")
    public ApiResponse<FormLayoutResponse> getFormLayout(
            @PathVariable UUID tableId, @RequestParam(defaultValue = "CREATE") String layoutKey) {
        return ApiResponse.ok(metadataLayoutService.getFormLayout(tableId, layoutKey));
    }

    @PutMapping("/tables/{tableId}/form-layouts")
    public ApiResponse<FormLayoutResponse> saveFormDraft(
            @PathVariable UUID tableId, @Valid @RequestBody SaveFormLayoutRequest request) {
        return ApiResponse.ok(metadataLayoutService.saveFormDraft(tableId, request), "Draft saved");
    }

    @PostMapping("/tables/{tableId}/form-layouts/publish")
    public ApiResponse<FormLayoutResponse> publishForm(
            @PathVariable UUID tableId, @RequestParam(defaultValue = "CREATE") String layoutKey) {
        return ApiResponse.ok(metadataLayoutService.publishFormLayout(tableId, layoutKey), "Layout published");
    }

    @DeleteMapping("/tables/{tableId}/form-layouts/draft")
    public ApiResponse<Void> discardFormDraft(
            @PathVariable UUID tableId, @RequestParam(defaultValue = "CREATE") String layoutKey) {
        metadataLayoutService.discardFormDraft(tableId, layoutKey);
        return ApiResponse.ok(null, "Draft discarded");
    }

    @GetMapping("/tables/{tableId}/list-layouts")
    public ApiResponse<ListLayoutResponse> getListLayout(
            @PathVariable UUID tableId, @RequestParam(required = false) UUID roleId) {
        return ApiResponse.ok(metadataLayoutService.getListLayout(tableId, roleId));
    }

    @PutMapping("/tables/{tableId}/list-layouts")
    public ApiResponse<ListLayoutResponse> saveListDraft(
            @PathVariable UUID tableId, @Valid @RequestBody SaveListLayoutRequest request) {
        return ApiResponse.ok(metadataLayoutService.saveListDraft(tableId, request), "Draft saved");
    }

    @PostMapping("/tables/{tableId}/list-layouts/publish")
    public ApiResponse<ListLayoutResponse> publishList(
            @PathVariable UUID tableId, @RequestParam(required = false) UUID roleId) {
        return ApiResponse.ok(metadataLayoutService.publishListLayout(tableId, roleId), "Layout published");
    }

    @DeleteMapping("/tables/{tableId}/list-layouts/draft")
    public ApiResponse<Void> discardListDraft(
            @PathVariable UUID tableId, @RequestParam(required = false) UUID roleId) {
        metadataLayoutService.discardListDraft(tableId, roleId);
        return ApiResponse.ok(null, "Draft discarded");
    }

    /** Runtime: any tenant user can read published layouts (no METADATA_VIEW required). */
    @GetMapping("/runtime/tables/{tableCode}/form-layout")
    public ApiResponse<FormLayoutResponse> runtimeFormLayout(
            @PathVariable String tableCode, @RequestParam(defaultValue = "CREATE") String layoutKey) {
        return ApiResponse.ok(metadataLayoutService.getPublishedFormLayoutByCode(tableCode, layoutKey));
    }

    @GetMapping("/runtime/tables/{tableCode}/form-bundle")
    public ApiResponse<RuntimeFormBundleResponse> runtimeFormBundle(
            @PathVariable String tableCode, @RequestParam(defaultValue = "CREATE") String layoutKey) {
        return ApiResponse.ok(metadataLayoutService.getPublishedFormBundle(tableCode, layoutKey));
    }

    @GetMapping("/runtime/tables/{tableCode}/list-layout")
    public ApiResponse<ListLayoutResponse> runtimeListLayout(
            @PathVariable String tableCode, @RequestParam(required = false) UUID roleId) {
        return ApiResponse.ok(metadataLayoutService.getPublishedListLayoutByCode(tableCode, roleId));
    }

    @GetMapping("/runtime/tables/{tableCode}/filter-fields")
    public ApiResponse<List<FilterFieldCatalogItem>> runtimeFilterFields(@PathVariable String tableCode) {
        return ApiResponse.ok(metadataLayoutService.getFilterFieldCatalog(tableCode));
    }
}
