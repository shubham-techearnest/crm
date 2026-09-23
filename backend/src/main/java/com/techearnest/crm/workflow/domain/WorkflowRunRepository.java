package com.techearnest.crm.workflow.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowRunRepository extends JpaRepository<WorkflowRun, UUID> {
    Optional<WorkflowRun> findByEventIdAndDefinitionId(UUID eventId, UUID definitionId);
}
