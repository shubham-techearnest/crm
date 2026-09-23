package com.techearnest.crm.document.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.document.api.dto.DocumentDtos.DocumentResponse;
import com.techearnest.crm.document.application.DocumentService;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @GetMapping
    public ApiResponse<List<DocumentResponse>> list(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) UUID entityId,
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String visibility,
            @RequestParam(required = false) UUID uploadedBy,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
                    java.time.Instant fromTs,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
                    java.time.Instant toTs,
            @RequestParam(defaultValue = "50") int size) {
        if (entityType != null && entityId != null) {
            return ApiResponse.ok(documentService.list(entityType, entityId));
        }
        return ApiResponse.ok(documentService.listRecent(
                organizationId, entityType, visibility, uploadedBy, fromTs, toTs, size));
    }

    @PostMapping
    public ApiResponse<DocumentResponse> upload(
            @RequestParam String entityType,
            @RequestParam UUID entityId,
            @RequestParam(required = false, defaultValue = "INTERNAL") String visibility,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(documentService.upload(entityType, entityId, visibility, file), "Document uploaded");
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<InputStreamResource> download(@PathVariable UUID id) {
        return documentService.download(id);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        documentService.delete(id);
        return ApiResponse.ok(null, "Document deleted");
    }
}
