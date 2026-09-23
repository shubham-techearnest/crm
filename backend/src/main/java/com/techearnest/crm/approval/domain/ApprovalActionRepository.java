package com.techearnest.crm.approval.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalActionRepository extends JpaRepository<ApprovalAction, UUID> {
    List<ApprovalAction> findByRequestIdOrderByCreatedAtAsc(UUID requestId);
}
