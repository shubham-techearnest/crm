package com.techearnest.crm.notification.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    @Query(
            """
            select n from Notification n
            where n.userId = :userId
              and (:unreadOnly = false or n.read = false)
            order by n.createdAt desc
            """)
    List<Notification> findForUser(
            @Param("userId") UUID userId, @Param("unreadOnly") boolean unreadOnly, Pageable pageable);

    @Query("select n from Notification n where n.id = :id and n.userId = :userId")
    Optional<Notification> findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);
}
