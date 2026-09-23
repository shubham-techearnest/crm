package com.techearnest.crm.metadata.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.CreateFieldRequest;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SysFieldResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.UpdateFieldRequest;
import com.techearnest.crm.metadata.application.MetadataStudioService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/metadata")
public class MetadataFieldController {

    private final MetadataStudioService metadataStudioService;

    public MetadataFieldController(MetadataStudioService metadataStudioService) {
        this.metadataStudioService = metadataStudioService;
    }

    @GetMapping("/tables/{tableId}/fields")
    public ApiResponse<List<SysFieldResponse>> list(@PathVariable UUID tableId) {
        return ApiResponse.ok(metadataStudioService.listFields(tableId));
    }

    @PostMapping("/tables/{tableId}/fields")
    public ApiResponse<SysFieldResponse> create(
            @PathVariable UUID tableId, @Valid @RequestBody CreateFieldRequest request) {
        return ApiResponse.ok(metadataStudioService.createField(tableId, request), "Field created");
    }

    @GetMapping("/fields/{id}")
    public ApiResponse<SysFieldResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(metadataStudioService.getField(id));
    }

    @PutMapping("/fields/{id}")
    public ApiResponse<SysFieldResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateFieldRequest request) {
        return ApiResponse.ok(metadataStudioService.updateField(id, request), "Field updated");
    }

    @DeleteMapping("/fields/{id}")
    public ApiResponse<Void> deactivate(@PathVariable UUID id) {
        metadataStudioService.deactivateField(id);
        return ApiResponse.ok(null, "Field deactivated");
    }
}
