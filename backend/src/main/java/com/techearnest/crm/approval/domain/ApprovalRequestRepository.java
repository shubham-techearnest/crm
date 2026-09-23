package com.techearnest.crm.approval.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, UUID> {
    List<ApprovalRequest> findByOrganizationIdAndStatusOrderBySubmittedAtDesc(
            UUID organizationId, String status);

    Optional<ApprovalRequest> findByOrganizationIdAndTargetTypeAndTargetIdAndStatus(
            UUID organizationId, String targetType, UUID targetId, String status);
}
