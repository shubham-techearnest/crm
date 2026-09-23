package com.techearnest.crm.workflow.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowActionRepository extends JpaRepository<WorkflowAction, UUID> {
    List<WorkflowAction> findByDefinitionIdAndActiveTrueOrderByActionOrderAsc(UUID definitionId);
}
