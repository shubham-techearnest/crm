package com.techearnest.crm.metadata.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.FieldAclResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.FormPolicyResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.RelatedListResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SaveFormPolicyRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SaveRelatedListRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.TableAclResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.UpsertFieldAclRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.UpsertTableAclRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.UserListPrefResponse;
import com.techearnest.crm.metadata.application.FieldAclService;
import com.techearnest.crm.metadata.application.MetadataExtensionService;
import com.techearnest.crm.metadata.application.TableAclService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
public class MetadataExtensionController {

    private final MetadataExtensionService extensionService;
    private final TableAclService tableAclService;
    private final FieldAclService fieldAclService;

    public MetadataExtensionController(
            MetadataExtensionService extensionService,
            TableAclService tableAclService,
            FieldAclService fieldAclService) {
        this.extensionService = extensionService;
        this.tableAclService = tableAclService;
        this.fieldAclService = fieldAclService;
    }

    @GetMapping("/list-prefs/{tableCode}")
    public ApiResponse<UserListPrefResponse> getPref(@PathVariable String tableCode) {
        return ApiResponse.ok(extensionService.getListPref(tableCode));
    }

    @PutMapping("/list-prefs/{tableCode}")
    public ApiResponse<UserListPrefResponse> savePref(
            @PathVariable String tableCode, @RequestBody JsonNode columns) {
        return ApiResponse.ok(extensionService.saveListPref(tableCode, columns), "Preferences saved");
    }

    @GetMapping("/tables/{tableId}/form-policies")
    public ApiResponse<List<FormPolicyResponse>> listPolicies(@PathVariable UUID tableId) {
        return ApiResponse.ok(extensionService.listPolicies(tableId));
    }

    @PostMapping("/tables/{tableId}/form-policies")
    public ApiResponse<FormPolicyResponse> createPolicy(
            @PathVariable UUID tableId, @Valid @RequestBody SaveFormPolicyRequest request) {
        return ApiResponse.ok(extensionService.savePolicy(tableId, request), "Policy saved");
    }

    @PostMapping("/form-policies/{policyId}/publish")
    public ApiResponse<FormPolicyResponse> publishPolicy(@PathVariable UUID policyId) {
        return ApiResponse.ok(extensionService.publishPolicy(policyId), "Policy published");
    }

    @GetMapping("/runtime/tables/{tableCode}/form-policies")
    public ApiResponse<List<FormPolicyResponse>> runtimePolicies(
            @PathVariable String tableCode, @RequestParam(defaultValue = "EDIT") String layoutKey) {
        return ApiResponse.ok(extensionService.publishedPolicies(tableCode, layoutKey));
    }

    @GetMapping("/tables/{tableId}/related-lists")
    public ApiResponse<List<RelatedListResponse>> listRelated(@PathVariable UUID tableId) {
        return ApiResponse.ok(extensionService.listRelated(tableId));
    }

    @PutMapping("/tables/{tableId}/related-lists")
    public ApiResponse<RelatedListResponse> saveRelated(
            @PathVariable UUID tableId, @Valid @RequestBody SaveRelatedListRequest request) {
        return ApiResponse.ok(extensionService.saveRelated(tableId, request), "Related list saved");
    }

    @PostMapping("/related-lists/{id}/publish")
    public ApiResponse<RelatedListResponse> publishRelated(@PathVariable UUID id) {
        return ApiResponse.ok(extensionService.publishRelated(id), "Related list published");
    }

    @GetMapping("/runtime/tables/{tableCode}/related-lists")
    public ApiResponse<List<RelatedListResponse>> runtimeRelated(@PathVariable String tableCode) {
        return ApiResponse.ok(extensionService.publishedRelated(tableCode));
    }

    @GetMapping("/table-acls")
    public ApiResponse<List<TableAclResponse>> listAcls() {
        return ApiResponse.ok(tableAclService.listMatrix());
    }

    @PutMapping("/table-acls")
    public ApiResponse<TableAclResponse> upsertAcl(@Valid @RequestBody UpsertTableAclRequest request) {
        return ApiResponse.ok(tableAclService.upsert(request), "ACL updated");
    }

    @GetMapping("/table-acls/me")
    public ApiResponse<Map<String, Map<String, Boolean>>> myAcls() {
        return ApiResponse.ok(tableAclService.meEffective());
    }

    @GetMapping("/field-acls")
    public ApiResponse<List<FieldAclResponse>> listFieldAcls(@RequestParam UUID tableId) {
        return ApiResponse.ok(fieldAclService.list(tableId));
    }

    @PutMapping("/field-acls")
    public ApiResponse<FieldAclResponse> upsertFieldAcl(@Valid @RequestBody UpsertFieldAclRequest request) {
        return ApiResponse.ok(fieldAclService.upsert(request), "Field ACL updated");
    }

    @GetMapping("/field-acls/me")
    public ApiResponse<Map<String, String>> myFieldAcls(@RequestParam String tableCode) {
        return ApiResponse.ok(fieldAclService.meForTable(tableCode));
    }
}
