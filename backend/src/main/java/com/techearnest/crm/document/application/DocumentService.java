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
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private static final Set<String> VISIBILITIES = Set.of("INTERNAL", "CUSTOMER");
    private static final long MAX_BYTES = 10L * 1024 * 1024;
    /** Excludes types a browser may execute (html, svg, js, ...) and executables. */
    static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "txt", "csv", "rtf", "md",
            "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
            "png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff",
            "zip", "eml", "msg");
    /** Types safe to hand back with their own Content-Type; everything else is served as octet-stream. */
    private static final Set<String> PASSTHROUGH_MEDIA_TYPES = Set.of(
            "application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/tiff");

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
        String fileName = sanitizeName(file.getOriginalFilename());
        requireAllowedExtension(fileName);
        ParentRef parent = attachmentParentGuard.requireVisibleParent(entityType, entityId);
        String vis = normalizeVisibility(visibility);
        UUID documentId = UUID.randomUUID();
        String storageKey;
        try (InputStream in = file.getInputStream()) {
            storageKey = documentStorage.store(
                    parent.organizationId().toString(),
                    documentId.toString(),
                    fileName,
                    in,
                    file.getSize());
        } catch (IOException e) {
            throw new BusinessException("STORAGE_ERROR", "Failed to read upload stream");
        }
        deleteStoredFileIfRolledBack(storageKey);

        Document document = Document.create(
                documentId,
                parent.organizationId(),
                parent.entityType(),
                parent.entityId(),
                fileName,
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
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(sanitizeName(document.getFileName()), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(safeMediaType(document.getContentType()))
                .body(new InputStreamResource(stream));
    }

    static MediaType safeMediaType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        try {
            MediaType parsed = MediaType.parseMediaType(contentType);
            String base = (parsed.getType() + "/" + parsed.getSubtype()).toLowerCase(Locale.ROOT);
            return PASSTHROUGH_MEDIA_TYPES.contains(base) ? MediaType.parseMediaType(base) : MediaType.APPLICATION_OCTET_STREAM;
        } catch (Exception ignored) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("DOCUMENT_DELETE");
        Document document = requireVisibleDocument(id);
        documentRepository.delete(document);
        deleteStoredFileAfterCommit(document.getStorageKey());
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

    static String sanitizeName(String name) {
        if (name == null || name.isBlank()) {
            return "file";
        }
        String baseName = name.replace('\\', '/');
        baseName = baseName.substring(baseName.lastIndexOf('/') + 1);
        String cleaned = baseName.replaceAll("[\\p{Cntrl}\"]", "").trim();
        if (cleaned.isEmpty()) {
            return "file";
        }
        return cleaned.substring(0, Math.min(cleaned.length(), 255));
    }

    private static void requireAllowedExtension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        String extension = dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException(
                    "FILE_TYPE_NOT_ALLOWED",
                    "Files of type '" + (extension.isEmpty() ? "(none)" : extension) + "' cannot be uploaded");
        }
    }

    private void deleteStoredFileIfRolledBack(String storageKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    deleteQuietly(storageKey);
                }
            }
        });
    }

    private void deleteStoredFileAfterCommit(String storageKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            documentStorage.delete(storageKey);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteQuietly(storageKey);
            }
        });
    }

    private void deleteQuietly(String storageKey) {
        try {
            documentStorage.delete(storageKey);
        } catch (RuntimeException e) {
            log.warn("Could not delete stored document file {}: {}", storageKey, e.getMessage());
        }
    }
}
