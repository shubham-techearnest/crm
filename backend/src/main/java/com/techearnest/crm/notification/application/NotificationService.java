package com.techearnest.crm.notification.application;

import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.notification.api.dto.NotificationDtos.NotificationResponse;
import com.techearnest.crm.notification.domain.Notification;
import com.techearnest.crm.notification.domain.NotificationRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final TenantAccess tenantAccess;

    public NotificationService(NotificationRepository notificationRepository, TenantAccess tenantAccess) {
        this.notificationRepository = notificationRepository;
        this.tenantAccess = tenantAccess;
    }

    @Transactional
    public void notify(
            UUID organizationId,
            UUID userId,
            String type,
            String title,
            String message,
            String entityType,
            UUID entityId) {
        if (userId == null) {
            return;
        }
        notificationRepository.save(
                Notification.create(organizationId, userId, type, title, message, entityType, entityId));
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> listMine(boolean unreadOnly, int size) {
        CurrentUser user = tenantAccess.requirePermission("NOTIFICATION_VIEW");
        return notificationRepository
                .findForUser(user.userId(), unreadOnly, PageRequest.of(0, Math.min(Math.max(size, 1), 100)))
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional
    public NotificationResponse markRead(UUID id) {
        CurrentUser user = tenantAccess.requirePermission("NOTIFICATION_VIEW");
        Notification notification = notificationRepository
                .findByIdAndUserId(id, user.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found"));
        notification.markRead();
        return NotificationResponse.from(notification);
    }
}
