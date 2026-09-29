package com.techearnest.crm.importer.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.importer.api.dto.BulkImportDtos.BulkImportRequest;
import com.techearnest.crm.importer.api.dto.BulkImportDtos.BulkImportResult;
import com.techearnest.crm.importer.api.dto.BulkImportDtos.ImportSchema;
import com.techearnest.crm.importer.application.BulkImportService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/imports")
public class BulkImportController {

    private final BulkImportService bulkImportService;

    public BulkImportController(BulkImportService bulkImportService) {
        this.bulkImportService = bulkImportService;
    }

    @GetMapping("/{module}/schema")
    public ApiResponse<ImportSchema> schema(
            @PathVariable String module, @RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(bulkImportService.schema(module, organizationId));
    }

    @PostMapping("/{module}/validate")
    public ApiResponse<BulkImportResult> validate(
            @PathVariable String module, @RequestBody BulkImportRequest request) {
        BulkImportResult result = bulkImportService.validateRows(module, request);
        return ApiResponse.ok(result, result.imported() + " of " + result.total() + " rows are ready to import");
    }

    @PostMapping("/{module}")
    public ApiResponse<BulkImportResult> importRows(
            @PathVariable String module, @RequestBody BulkImportRequest request) {
        BulkImportResult result = bulkImportService.importRows(module, request);
        return ApiResponse.ok(result, result.imported() + " of " + result.total() + " rows imported");
    }
}
