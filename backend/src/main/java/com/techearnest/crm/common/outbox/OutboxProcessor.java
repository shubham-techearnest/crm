package com.techearnest.crm.common.outbox;

import com.techearnest.crm.workflow.application.WorkflowEngine;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OutboxProcessor {

    private static final Logger log = LoggerFactory.getLogger(OutboxProcessor.class);

    private final DomainEventRepository repository;
    private final WorkflowEngine workflowEngine;

    public OutboxProcessor(DomainEventRepository repository, WorkflowEngine workflowEngine) {
        this.repository = repository;
        this.workflowEngine = workflowEngine;
    }

    @Scheduled(fixedDelayString = "${crm.outbox.poll-ms:5000}")
    @Transactional
    public void poll() {
        List<DomainEventRecord> batch = repository.findReady(Instant.now());
        for (DomainEventRecord event : batch) {
            try {
                workflowEngine.handleOutboxEvent(event);
                event.markProcessed();
                repository.save(event);
            } catch (Exception ex) {
                log.warn("Outbox handler failed for {}: {}", event.getId(), ex.getMessage());
                event.markFailed(ex.getMessage());
                repository.save(event);
            }
        }
    }
}
