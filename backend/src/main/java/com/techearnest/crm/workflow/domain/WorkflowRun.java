package com.techearnest.crm.workflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workflow_runs")
public class WorkflowRun {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "definition_id", nullable = false)
    private UUID definitionId;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(nullable = false, length = 32)
    private String status = "PENDING";

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(columnDefinition = "TEXT")
    private String error;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static WorkflowRun start(UUID organizationId, UUID definitionId, UUID eventId) {
        WorkflowRun run = new WorkflowRun();
        run.id = UUID.randomUUID();
        run.organizationId = organizationId;
        run.definitionId = definitionId;
        run.eventId = eventId;
        run.status = "RUNNING";
        run.startedAt = Instant.now();
        run.createdAt = Instant.now();
        return run;
    }

    public void markSucceeded() {
        this.status = "SUCCEEDED";
        this.finishedAt = Instant.now();
    }

    public void markFailed(String error) {
        this.status = "FAILED";
        this.error = error;
        this.finishedAt = Instant.now();
    }

    public void markSkipped() {
        this.status = "SKIPPED";
        this.finishedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getStatus() {
        return status;
    }
}
