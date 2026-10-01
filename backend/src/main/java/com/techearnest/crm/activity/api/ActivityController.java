package com.techearnest.crm.activity.api;

import com.techearnest.crm.activity.api.dto.ActivityDtos.ActivityResponse;
import com.techearnest.crm.activity.api.dto.ActivityDtos.CreateActivityRequest;
import com.techearnest.crm.activity.api.dto.ActivityDtos.UpdateActivityRequest;
import com.techearnest.crm.activity.application.ActivityService;
import com.techearnest.crm.common.api.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
@RequestMapping("/api/v1/activities")
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping
    public ApiResponse<List<ActivityResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String relatedEntityType,
            @RequestParam(required = false) UUID relatedEntityId,
            @RequestParam(required = false) UUID assignedTo,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String callDirection,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
                    java.time.Instant dueFrom,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
                    java.time.Instant dueTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = activityService.list(
                organizationId,
                relatedEntityType,
                relatedEntityId,
                assignedTo,
                type,
                status,
                outcome,
                callDirection,
                dueFrom,
                dueTo,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/{id}")
    public ApiResponse<ActivityResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(activityService.get(id));
    }

    @PostMapping
    public ApiResponse<ActivityResponse> create(@Valid @RequestBody CreateActivityRequest request) {
        return ApiResponse.ok(activityService.create(request), "Activity created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<ActivityResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateActivityRequest request) {
        return ApiResponse.ok(activityService.update(id, request), "Activity updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        activityService.delete(id);
        return ApiResponse.ok(null, "Activity deleted successfully");
    }

    @PostMapping("/bulk-assign")
    public ApiResponse<com.techearnest.crm.common.bulk.BulkDtos.BulkResult> bulkAssign(
            @Valid @RequestBody com.techearnest.crm.common.bulk.BulkDtos.BulkAssignOwnerRequest request) {
        return ApiResponse.ok(activityService.bulkAssign(request), "Bulk assign completed");
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<ActivityResponse> complete(@PathVariable UUID id) {
        return ApiResponse.ok(activityService.complete(id), "Activity completed successfully");
    }
}
