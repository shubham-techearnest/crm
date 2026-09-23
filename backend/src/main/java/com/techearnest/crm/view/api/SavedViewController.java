package com.techearnest.crm.view.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.view.api.dto.SavedViewDtos.CreateSavedViewRequest;
import com.techearnest.crm.view.api.dto.SavedViewDtos.SavedViewResponse;
import com.techearnest.crm.view.api.dto.SavedViewDtos.UpdateSavedViewRequest;
import com.techearnest.crm.view.application.SavedViewService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/saved-views")
public class SavedViewController {

    private final SavedViewService savedViewService;

    public SavedViewController(SavedViewService savedViewService) {
        this.savedViewService = savedViewService;
    }

    @GetMapping
    public ApiResponse<List<SavedViewResponse>> list(
            @RequestParam String module, @RequestParam(required = false) UUID organizationId) {
        return ApiResponse.ok(savedViewService.list(module, organizationId));
    }

    @PostMapping
    public ApiResponse<SavedViewResponse> create(@Valid @RequestBody CreateSavedViewRequest request) {
        return ApiResponse.ok(savedViewService.create(request), "Saved view created");
    }

    @PutMapping("/{id}")
    public ApiResponse<SavedViewResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateSavedViewRequest request) {
        return ApiResponse.ok(savedViewService.update(id, request), "Saved view updated");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        savedViewService.delete(id);
        return ApiResponse.ok(null, "Saved view deleted");
    }
}
