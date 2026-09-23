package com.techearnest.crm.approval.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalStepRepository extends JpaRepository<ApprovalStep, UUID> {
    List<ApprovalStep> findByWorkflowIdAndActiveTrueOrderByStepOrderAsc(UUID workflowId);
}
