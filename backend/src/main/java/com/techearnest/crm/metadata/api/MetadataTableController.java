package com.techearnest.crm.metadata.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.SysTableResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.UpdateTableRequest;
import com.techearnest.crm.metadata.application.MetadataStudioService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/metadata/tables")
public class MetadataTableController {

    private final MetadataStudioService metadataStudioService;

    public MetadataTableController(MetadataStudioService metadataStudioService) {
        this.metadataStudioService = metadataStudioService;
    }

    @GetMapping
    public ApiResponse<List<SysTableResponse>> list(@RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(metadataStudioService.listTables(organizationId));
    }

    @GetMapping("/{id}")
    public ApiResponse<SysTableResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(metadataStudioService.getTable(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<SysTableResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateTableRequest request) {
        return ApiResponse.ok(metadataStudioService.updateTable(id, request), "Table updated");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        metadataStudioService.deleteTable(id);
        return ApiResponse.ok(null, "Table deleted");
    }
}
