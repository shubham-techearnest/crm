package com.techearnest.crm.common.outbox;

import com.techearnest.crm.workflow.application.WorkflowEngine;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Each event is handled in its own transaction: a failing handler leaves the Postgres transaction aborted, so
 * sharing one transaction across the batch would fail every later event and roll back the failure bookkeeping.
 */
@Component
public class OutboxProcessor {

    static final int MAX_ATTEMPTS = 10;
    private static final int BATCH_SIZE = 100;
    private static final int MAX_ERROR_LENGTH = 2000;

    private static final Logger log = LoggerFactory.getLogger(OutboxProcessor.class);

    private final DomainEventRepository repository;
    private final WorkflowEngine workflowEngine;
    private final TransactionTemplate transactionTemplate;

    public OutboxProcessor(
            DomainEventRepository repository,
            WorkflowEngine workflowEngine,
            PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.workflowEngine = workflowEngine;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Scheduled(fixedDelayString = "${crm.outbox.poll-ms:5000}")
    public void poll() {
        List<UUID> ids = repository.findReadyIds(Instant.now(), MAX_ATTEMPTS, Limit.of(BATCH_SIZE));
        for (UUID id : ids) {
            try {
                transactionTemplate.executeWithoutResult(status -> repository.findById(id).ifPresent(event -> {
                    if (event.getProcessedAt() != null) {
                        return;
                    }
                    workflowEngine.handleOutboxEvent(event);
                    event.markProcessed();
                    repository.save(event);
                }));
            } catch (RuntimeException ex) {
                recordFailure(id, ex);
            }
        }
    }

    private void recordFailure(UUID id, RuntimeException ex) {
        String message = rootMessage(ex);
        try {
            transactionTemplate.executeWithoutResult(status -> repository.findById(id).ifPresent(event -> {
                event.markFailed(message);
                repository.save(event);
                if (event.getAttempts() >= MAX_ATTEMPTS) {
                    log.error("Outbox event {} ({}) gave up after {} attempts: {}",
                            id, event.getEventType(), event.getAttempts(), message);
                } else {
                    log.warn("Outbox event {} ({}) failed, attempt {}: {}",
                            id, event.getEventType(), event.getAttempts(), message);
                }
            }));
        } catch (RuntimeException bookkeeping) {
            log.error("Could not record outbox failure for {}: {}", id, bookkeeping.getMessage());
        }
    }

    private static String rootMessage(Throwable ex) {
        Throwable root = ex;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        String message = root.getMessage() == null ? root.getClass().getSimpleName() : root.getMessage();
        return message.length() > MAX_ERROR_LENGTH ? message.substring(0, MAX_ERROR_LENGTH) : message;
    }
}
