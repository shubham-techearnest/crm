package com.techearnest.crm.activity.api.dto;

import com.techearnest.crm.activity.domain.Activity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class ActivityDtos {

    private ActivityDtos() {}

    public record ActivityResponse(
            UUID id,
            UUID organizationId,
            UUID regionId,
            String type,
            String subject,
            String description,
            String status,
            String priority,
            Instant dueDate,
            UUID assignedTo,
            String relatedEntityType,
            UUID relatedEntityId,
            Instant completedAt,
            String location,
            String attendees,
            String outcome,
            String callDirection,
            Integer durationSeconds,
            Instant createdAt,
            Instant updatedAt) {

        public static ActivityResponse from(Activity activity) {
            return new ActivityResponse(
                    activity.getId(),
                    activity.getOrganizationId(),
                    activity.getRegionId(),
                    activity.getType(),
                    activity.getSubject(),
                    activity.getDescription(),
                    activity.getStatus(),
                    activity.getPriority(),
                    activity.getDueDate(),
                    activity.getAssignedTo(),
                    activity.getRelatedEntityType(),
                    activity.getRelatedEntityId(),
                    activity.getCompletedAt(),
                    activity.getLocation(),
                    activity.getAttendees(),
                    activity.getOutcome(),
                    activity.getCallDirection(),
                    activity.getDurationSeconds(),
                    activity.getCreatedAt(),
                    activity.getUpdatedAt());
        }
    }

    public record CreateActivityRequest(
            UUID organizationId,
            UUID regionId,
            @NotBlank @Size(max = 32) String type,
            @NotBlank @Size(max = 255) String subject,
            String description,
            @Size(max = 32) String status,
            @Size(max = 16) String priority,
            Instant dueDate,
            UUID assignedTo,
            @NotBlank @Size(max = 32) String relatedEntityType,
            @NotNull UUID relatedEntityId,
            @Size(max = 255) String location,
            String attendees,
            @Size(max = 64) String outcome,
            @Size(max = 16) String callDirection,
            Integer durationSeconds) {}

    public record UpdateActivityRequest(
            @Size(max = 32) String type,
            @NotBlank @Size(max = 255) String subject,
            String description,
            @Size(max = 32) String status,
            @Size(max = 16) String priority,
            Instant dueDate,
            UUID assignedTo,
            @Size(max = 255) String location,
            String attendees,
            @Size(max = 64) String outcome,
            @Size(max = 16) String callDirection,
            Integer durationSeconds) {}
}
