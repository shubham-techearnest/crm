package com.techearnest.crm.note.api.dto;

import com.techearnest.crm.note.domain.Note;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class NoteDtos {

    private NoteDtos() {}

    public record NoteResponse(
            UUID id,
            UUID organizationId,
            String entityType,
            UUID entityId,
            String body,
            UUID createdBy,
            Instant createdAt,
            Instant updatedAt) {

        public static NoteResponse from(Note note) {
            return new NoteResponse(
                    note.getId(),
                    note.getOrganizationId(),
                    note.getEntityType(),
                    note.getEntityId(),
                    note.getBody(),
                    note.getCreatedBy(),
                    note.getCreatedAt(),
                    note.getUpdatedAt());
        }
    }

    public record CreateNoteRequest(
            @NotBlank @Size(max = 32) String entityType,
            @NotNull UUID entityId,
            @NotBlank @Size(max = 10000) String body) {}
}
