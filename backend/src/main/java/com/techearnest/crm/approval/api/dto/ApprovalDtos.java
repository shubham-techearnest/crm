package com.techearnest.crm.approval.api.dto;

import com.techearnest.crm.approval.domain.ApprovalRequest;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.UUID;

public final class ApprovalDtos {

    private ApprovalDtos() {}

    public record ApprovalRequestResponse(
            UUID id,
            UUID organizationId,
            UUID workflowId,
            String targetType,
            UUID targetId,
            String status,
            UUID currentStepId,
            UUID submittedBy,
            Instant submittedAt,
            UUID regionId,
            Instant createdAt,
            Instant updatedAt) {
        public static ApprovalRequestResponse from(ApprovalRequest request) {
            return new ApprovalRequestResponse(
                    request.getId(),
                    request.getOrganizationId(),
                    request.getWorkflowId(),
                    request.getTargetType(),
                    request.getTargetId(),
                    request.getStatus(),
                    request.getCurrentStepId(),
                    request.getSubmittedBy(),
                    request.getSubmittedAt(),
                    request.getRegionId(),
                    request.getCreatedAt(),
                    request.getUpdatedAt());
        }
    }

    public record ApprovalActionRequest(@NotBlank String action, String comment) {}
}
