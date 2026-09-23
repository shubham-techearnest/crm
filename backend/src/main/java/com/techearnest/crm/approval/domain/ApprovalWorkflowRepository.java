package com.techearnest.crm.approval.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalWorkflowRepository extends JpaRepository<ApprovalWorkflow, UUID> {
    Optional<ApprovalWorkflow> findByOrganizationIdAndCode(UUID organizationId, String code);

    List<ApprovalWorkflow> findByOrganizationIdAndTargetTypeAndActiveTrue(
            UUID organizationId, String targetType);
}
