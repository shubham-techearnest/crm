package com.techearnest.crm.workflow.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.outbox.DomainEventRecord;
import com.techearnest.crm.deal.domain.Deal;
import com.techearnest.crm.deal.domain.DealRepository;
import com.techearnest.crm.notification.application.NotificationService;
import com.techearnest.crm.workflow.domain.WorkflowAction;
import com.techearnest.crm.workflow.domain.WorkflowActionRepository;
import com.techearnest.crm.workflow.domain.WorkflowDefinition;
import com.techearnest.crm.workflow.domain.WorkflowDefinitionRepository;
import com.techearnest.crm.workflow.domain.WorkflowRun;
import com.techearnest.crm.workflow.domain.WorkflowRunRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowEngine {

    public static final String EVENT_DEAL_WON = "DEAL_WON";
    public static final String DEF_DEAL_WON_NOTIFY = "DEAL_WON_NOTIFY_PM";

    private final WorkflowDefinitionRepository definitionRepository;
    private final WorkflowActionRepository actionRepository;
    private final WorkflowRunRepository runRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final DealRepository dealRepository;
    private final ObjectMapper objectMapper;

    public WorkflowEngine(
            WorkflowDefinitionRepository definitionRepository,
            WorkflowActionRepository actionRepository,
            WorkflowRunRepository runRepository,
            NotificationService notificationService,
            AuditService auditService,
            DealRepository dealRepository,
            ObjectMapper objectMapper) {
        this.definitionRepository = definitionRepository;
        this.actionRepository = actionRepository;
        this.runRepository = runRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.dealRepository = dealRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void handleOutboxEvent(DomainEventRecord event) {
        if (EVENT_DEAL_WON.equals(event.getEventType())) {
            ensureDealWonWorkflow(event.getOrganizationId());
        }
        List<WorkflowDefinition> defs = definitionRepository.findByOrganizationIdAndEventTypeAndActiveTrue(
                event.getOrganizationId(), event.getEventType());
        if (defs.isEmpty() && EVENT_DEAL_WON.equals(event.getEventType())) {
            // built-in fallback if ensure failed
            executeDealWonBuiltin(event);
            return;
        }
        for (WorkflowDefinition def : defs) {
            if (runRepository.findByEventIdAndDefinitionId(event.getId(), def.getId()).isPresent()) {
                continue;
            }
            WorkflowRun run = WorkflowRun.start(event.getOrganizationId(), def.getId(), event.getId());
            runRepository.save(run);
            try {
                for (WorkflowAction action :
                        actionRepository.findByDefinitionIdAndActiveTrueOrderByActionOrderAsc(def.getId())) {
                    executeAction(event, action);
                }
                run.markSucceeded();
                auditService.recordWithSummary(
                        event.getOrganizationId(),
                        null,
                        "EXECUTE",
                        "WORKFLOW_RUN",
                        run.getId(),
                        "Workflow " + def.getCode() + " succeeded for " + event.getEventType());
            } catch (Exception ex) {
                run.markFailed(ex.getMessage());
                runRepository.save(run);
                throw ex;
            }
            runRepository.save(run);
        }
    }

    private void executeAction(DomainEventRecord event, WorkflowAction action) {
        if ("NOOP".equalsIgnoreCase(action.getActionType())) {
            return;
        }
        if ("NOTIFY".equalsIgnoreCase(action.getActionType())) {
            executeNotify(event, action.getConfigJson());
            return;
        }
        // idempotent stub for unknown action types
    }

    private void executeNotify(DomainEventRecord event, String configJson) {
        UUID recipient = null;
        String title = "Workflow notification";
        String message = event.getEventType() + " occurred";
        try {
            JsonNode cfg = objectMapper.readTree(configJson == null ? "{}" : configJson);
            if (cfg.hasNonNull("title")) {
                title = cfg.get("title").asText();
            }
            if (cfg.hasNonNull("message")) {
                message = cfg.get("message").asText();
            }
            if (cfg.hasNonNull("recipientUserId")) {
                recipient = UUID.fromString(cfg.get("recipientUserId").asText());
            }
        } catch (Exception ignored) {
            // use defaults
        }
        if (recipient == null && EVENT_DEAL_WON.equals(event.getEventType()) && event.getEntityId() != null) {
            Deal deal = dealRepository.findActiveById(event.getEntityId()).orElse(null);
            if (deal != null) {
                recipient = deal.getOwnerId();
                title = "Deal won — notify PM";
                message = "Deal \"" + deal.getName() + "\" was marked WON. Please plan delivery.";
            }
        }
        notificationService.notify(
                event.getOrganizationId(),
                recipient,
                event.getEventType(),
                title,
                message,
                event.getEntityType(),
                event.getEntityId());
    }

    private void executeDealWonBuiltin(DomainEventRecord event) {
        executeNotify(event, "{\"title\":\"Deal won — notify PM\"}");
        auditService.recordWithSummary(
                event.getOrganizationId(),
                null,
                "EXECUTE",
                "WORKFLOW_RUN",
                event.getId(),
                "Built-in DEAL_WON notify executed");
    }

    private void ensureDealWonWorkflow(UUID organizationId) {
        if (organizationId == null) {
            return;
        }
        definitionRepository
                .findByOrganizationIdAndCode(organizationId, DEF_DEAL_WON_NOTIFY)
                .orElseGet(() -> {
                    WorkflowDefinition def = WorkflowDefinition.create(
                            organizationId, DEF_DEAL_WON_NOTIFY, "Deal WON → notify PM", EVENT_DEAL_WON);
                    definitionRepository.save(def);
                    actionRepository.save(WorkflowAction.create(
                            organizationId,
                            def.getId(),
                            1,
                            "NOTIFY",
                            "{\"title\":\"Deal won — notify PM\",\"message\":\"A deal was marked WON. Plan delivery.\"}"));
                    return def;
                });
    }
}
