package com.techearnest.crm.workflow.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowDefinitionRepository extends JpaRepository<WorkflowDefinition, UUID> {
    List<WorkflowDefinition> findByOrganizationIdAndEventTypeAndActiveTrue(
            UUID organizationId, String eventType);

    Optional<WorkflowDefinition> findByOrganizationIdAndCode(UUID organizationId, String code);
}
