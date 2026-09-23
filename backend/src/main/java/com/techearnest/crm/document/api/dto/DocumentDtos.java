package com.techearnest.crm.document.api.dto;

import com.techearnest.crm.document.domain.Document;
import java.time.Instant;
import java.util.UUID;

public final class DocumentDtos {

    private DocumentDtos() {}

    public record DocumentResponse(
            UUID id,
            UUID organizationId,
            String entityType,
            UUID entityId,
            String fileName,
            String contentType,
            Long sizeBytes,
            UUID uploadedBy,
            String visibility,
            Instant createdAt) {

        public static DocumentResponse from(Document document) {
            return new DocumentResponse(
                    document.getId(),
                    document.getOrganizationId(),
                    document.getEntityType(),
                    document.getEntityId(),
                    document.getFileName(),
                    document.getContentType(),
                    document.getSizeBytes(),
                    document.getUploadedBy(),
                    document.getVisibility(),
                    document.getCreatedAt());
        }
    }
}
