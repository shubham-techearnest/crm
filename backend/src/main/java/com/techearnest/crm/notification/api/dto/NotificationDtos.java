package com.techearnest.crm.notification.api.dto;

import com.techearnest.crm.notification.domain.Notification;
import java.time.Instant;
import java.util.UUID;

public final class NotificationDtos {

    private NotificationDtos() {}

    public record NotificationResponse(
            UUID id,
            String type,
            String title,
            String message,
            String entityType,
            UUID entityId,
            boolean read,
            Instant createdAt) {

        public static NotificationResponse from(Notification notification) {
            return new NotificationResponse(
                    notification.getId(),
                    notification.getType(),
                    notification.getTitle(),
                    notification.getMessage(),
                    notification.getEntityType(),
                    notification.getEntityId(),
                    notification.isRead(),
                    notification.getCreatedAt());
        }
    }
}
