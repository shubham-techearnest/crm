package com.techearnest.crm.note.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.note.api.dto.NoteDtos.CreateNoteRequest;
import com.techearnest.crm.note.api.dto.NoteDtos.NoteResponse;
import com.techearnest.crm.note.application.NoteService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notes")
public class NoteController {

    private final NoteService noteService;

    public NoteController(NoteService noteService) {
        this.noteService = noteService;
    }

    @GetMapping
    public ApiResponse<List<NoteResponse>> list(
            @RequestParam String entityType, @RequestParam UUID entityId) {
        return ApiResponse.ok(noteService.list(entityType, entityId));
    }

    @PostMapping
    public ApiResponse<NoteResponse> create(@Valid @RequestBody CreateNoteRequest request) {
        return ApiResponse.ok(noteService.create(request), "Note created");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        noteService.delete(id);
        return ApiResponse.ok(null, "Note deleted");
    }
}
