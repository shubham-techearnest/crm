package com.techearnest.crm.document.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "documents")
public class Document {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "entity_type", nullable = false, length = 32)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "storage_key", nullable = false, length = 512)
    private String storageKey;

    @Column(name = "content_type", length = 128)
    private String contentType;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "uploaded_by", nullable = false)
    private UUID uploadedBy;

    @Column(nullable = false, length = 32)
    private String visibility;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static Document create(
            UUID organizationId,
            String entityType,
            UUID entityId,
            String fileName,
            String storageKey,
            String contentType,
            Long sizeBytes,
            UUID uploadedBy,
            String visibility) {
        return create(
                UUID.randomUUID(),
                organizationId,
                entityType,
                entityId,
                fileName,
                storageKey,
                contentType,
                sizeBytes,
                uploadedBy,
                visibility);
    }

    public static Document create(
            UUID id,
            UUID organizationId,
            String entityType,
            UUID entityId,
            String fileName,
            String storageKey,
            String contentType,
            Long sizeBytes,
            UUID uploadedBy,
            String visibility) {
        Document doc = new Document();
        doc.id = id;
        doc.organizationId = organizationId;
        doc.entityType = entityType;
        doc.entityId = entityId;
        doc.fileName = fileName;
        doc.storageKey = storageKey;
        doc.contentType = contentType;
        doc.sizeBytes = sizeBytes;
        doc.uploadedBy = uploadedBy;
        doc.visibility = visibility == null || visibility.isBlank() ? "INTERNAL" : visibility;
        doc.createdAt = Instant.now();
        return doc;
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public String getEntityType() {
        return entityType;
    }

    public UUID getEntityId() {
        return entityId;
    }

    public String getFileName() {
        return fileName;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public String getContentType() {
        return contentType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public UUID getUploadedBy() {
        return uploadedBy;
    }

    public String getVisibility() {
        return visibility;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
