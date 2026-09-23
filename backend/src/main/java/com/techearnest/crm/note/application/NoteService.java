package com.techearnest.crm.note.application;

import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.attachment.AttachmentParentGuard;
import com.techearnest.crm.common.attachment.AttachmentParentGuard.ParentRef;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.note.api.dto.NoteDtos.CreateNoteRequest;
import com.techearnest.crm.note.api.dto.NoteDtos.NoteResponse;
import com.techearnest.crm.note.domain.Note;
import com.techearnest.crm.note.domain.NoteRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoteService {

    private final NoteRepository noteRepository;
    private final AttachmentParentGuard attachmentParentGuard;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;

    public NoteService(
            NoteRepository noteRepository,
            AttachmentParentGuard attachmentParentGuard,
            TenantAccess tenantAccess,
            AuditService auditService) {
        this.noteRepository = noteRepository;
        this.attachmentParentGuard = attachmentParentGuard;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> list(String entityType, UUID entityId) {
        tenantAccess.requirePermission("NOTE_VIEW");
        ParentRef parent = attachmentParentGuard.requireVisibleParent(entityType, entityId);
        return noteRepository.findByEntity(parent.organizationId(), parent.entityType(), parent.entityId()).stream()
                .map(NoteResponse::from)
                .toList();
    }

    @Transactional
    public NoteResponse create(CreateNoteRequest request) {
        CurrentUser user = tenantAccess.requirePermission("NOTE_CREATE");
        if (request.body() == null || request.body().isBlank()) {
            throw new BusinessException("NOTE_BODY_REQUIRED", "Note body is required");
        }
        ParentRef parent = attachmentParentGuard.requireVisibleParent(request.entityType(), request.entityId());
        Note note = Note.create(
                parent.organizationId(),
                parent.entityType(),
                parent.entityId(),
                request.body().trim(),
                user.userId());
        noteRepository.save(note);
        auditService.record(
                parent.organizationId(), user.userId(), "CREATE", "NOTE", note.getId(), parent.regionId());
        return NoteResponse.from(note);
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("NOTE_DELETE");
        Note note = noteRepository
                .findActiveById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        ParentRef parent = attachmentParentGuard.requireVisibleParent(note.getEntityType(), note.getEntityId());
        note.softDelete();
        auditService.record(
                note.getOrganizationId(), user.userId(), "DELETE", "NOTE", note.getId(), parent.regionId());
    }
}
