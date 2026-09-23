package com.techearnest.crm.document.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.attachment.AttachmentParentGuard;
import com.techearnest.crm.common.attachment.AttachmentParentGuard.ParentRef;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.document.api.dto.DocumentDtos.DocumentResponse;
import com.techearnest.crm.document.domain.Document;
import com.techearnest.crm.document.domain.DocumentRepository;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentService {

    private static final Set<String> VISIBILITIES = Set.of("INTERNAL", "CUSTOMER");
    private static final long MAX_BYTES = 10L * 1024 * 1024;

    private final DocumentRepository documentRepository;
    private final DocumentStorage documentStorage;
    private final AttachmentParentGuard attachmentParentGuard;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public DocumentService(
            DocumentRepository documentRepository,
            DocumentStorage documentStorage,
            AttachmentParentGuard attachmentParentGuard,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.documentRepository = documentRepository;
        this.documentStorage = documentStorage;
        this.attachmentParentGuard = attachmentParentGuard;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> list(String entityType, UUID entityId) {
        tenantAccess.requirePermission("DOCUMENT_VIEW");
        ParentRef parent = attachmentParentGuard.requireVisibleParent(entityType, entityId);
        return documentRepository.findByEntity(parent.organizationId(), parent.entityType(), parent.entityId()).stream()
                .map(DocumentResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> listRecent(
            UUID organizationId,
            String entityType,
            String visibility,
            UUID uploadedBy,
            java.time.Instant fromTs,
            java.time.Instant toTs,
            int size) {
        tenantAccess.requirePermission("DOCUMENT_VIEW");
        UUID orgId = tenantAccess.resolveOrganizationId(organizationId);
        int limit = Math.min(Math.max(size, 1), 100);
        return documentRepository
                .searchRecent(
                        orgId,
                        blankToNull(entityType),
                        blankToNull(visibility),
                        uploadedBy,
                        fromTs,
                        toTs,
                        org.springframework.data.domain.PageRequest.of(0, limit))
                .stream()
                .map(DocumentResponse::from)
                .toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Transactional
    public DocumentResponse upload(
            String entityType, UUID entityId, String visibility, MultipartFile file) {
        CurrentUser user = tenantAccess.requirePermission("DOCUMENT_UPLOAD");
        if (file == null || file.isEmpty()) {
            throw new BusinessException("FILE_REQUIRED", "A file is required");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE", "File exceeds 10MB limit");
        }
        ParentRef parent = attachmentParentGuard.requireVisibleParent(entityType, entityId);
        String vis = normalizeVisibility(visibility);
        UUID documentId = UUID.randomUUID();
        String storageKey;
        try (InputStream in = file.getInputStream()) {
            storageKey = documentStorage.store(
                    parent.organizationId().toString(),
                    documentId.toString(),
                    file.getOriginalFilename(),
                    in,
                    file.getSize());
        } catch (IOException e) {
            throw new BusinessException("STORAGE_ERROR", "Failed to read upload stream");
        }

        Document document = Document.create(
                documentId,
                parent.organizationId(),
                parent.entityType(),
                parent.entityId(),
                sanitizeName(file.getOriginalFilename()),
                storageKey,
                file.getContentType(),
                file.getSize(),
                user.userId(),
                vis);
        documentRepository.save(document);
        auditService.record(
                parent.organizationId(),
                user.userId(),
                "CREATE",
                "DOCUMENT",
                document.getId(),
                parent.regionId());
        return DocumentResponse.from(document);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<InputStreamResource> download(UUID id) {
        tenantAccess.requirePermission("DOCUMENT_VIEW");
        Document document = requireVisibleDocument(id);
        InputStream stream = documentStorage.open(document.getStorageKey());
        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        if (document.getContentType() != null && !document.getContentType().isBlank()) {
            try {
                mediaType = MediaType.parseMediaType(document.getContentType());
            } catch (Exception ignored) {
                // keep octet-stream
            }
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + document.getFileName() + "\"")
                .contentType(mediaType)
                .body(new InputStreamResource(stream));
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("DOCUMENT_DELETE");
        Document document = requireVisibleDocument(id);
        documentRepository.delete(document);
        documentStorage.delete(document.getStorageKey());
        auditService.record(
                document.getOrganizationId(),
                user.userId(),
                "DELETE",
                "DOCUMENT",
                document.getId(),
                null);
    }

    private Document requireVisibleDocument(UUID id) {
        Document document = documentRepository
                .findByIdActive(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        attachmentParentGuard.requireVisibleParent(document.getEntityType(), document.getEntityId());
        tenantAccess.assertOrganizationVisible(document.getOrganizationId());
        return document;
    }

    private static String normalizeVisibility(String visibility) {
        if (visibility == null || visibility.isBlank()) {
            return "INTERNAL";
        }
        String vis = visibility.trim().toUpperCase(Locale.ROOT);
        if (!VISIBILITIES.contains(vis)) {
            throw new BusinessException("INVALID_VISIBILITY", "visibility must be INTERNAL or CUSTOMER");
        }
        return vis;
    }

    private static String sanitizeName(String name) {
        if (name == null || name.isBlank()) {
            return "file";
        }
        return name.trim().substring(0, Math.min(name.trim().length(), 255));
    }
}
