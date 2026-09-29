package com.techearnest.crm.common.outbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.techearnest.crm.workflow.application.WorkflowEngine;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Limit;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

class OutboxProcessorTest {

    private DomainEventRepository repository;
    private WorkflowEngine workflowEngine;
    private OutboxProcessor processor;

    @BeforeEach
    void setUp() {
        repository = mock(DomainEventRepository.class);
        workflowEngine = mock(WorkflowEngine.class);
        PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
        when(txManager.getTransaction(any())).thenAnswer(invocation -> new SimpleTransactionStatus());
        processor = new OutboxProcessor(repository, workflowEngine, txManager);
    }

    private DomainEventRecord event(String type) {
        DomainEventRecord event = DomainEventRecord.create(UUID.randomUUID(), type, "{}", null, null, null);
        when(repository.findById(event.getId())).thenReturn(Optional.of(event));
        return event;
    }

    @Test
    void failingEventDoesNotBlockTheRestOfTheBatch() {
        DomainEventRecord poison = event("POISON");
        DomainEventRecord healthy = event("HEALTHY");
        when(repository.findReadyIds(any(), anyInt(), any(Limit.class)))
                .thenReturn(List.of(poison.getId(), healthy.getId()));
        doThrow(new IllegalStateException("outer", new IllegalArgumentException("invalid input syntax for type json")))
                .when(workflowEngine)
                .handleOutboxEvent(poison);

        processor.poll();

        assertThat(poison.getProcessedAt()).isNull();
        assertThat(poison.getAttempts()).isEqualTo(1);
        assertThat(poison.getLastError()).isEqualTo("invalid input syntax for type json");
        assertThat(healthy.getProcessedAt()).isNotNull();
        assertThat(healthy.getAttempts()).isZero();
    }

    @Test
    void alreadyProcessedEventIsNotHandledAgain() {
        DomainEventRecord done = event("DONE");
        done.markProcessed();
        when(repository.findReadyIds(any(), anyInt(), any(Limit.class))).thenReturn(List.of(done.getId()));

        processor.poll();

        verify(workflowEngine, never()).handleOutboxEvent(done);
    }
}
