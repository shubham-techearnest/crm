package com.techearnest.crm.project.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.util.UUID;
import org.springframework.data.domain.Persistable;

@Entity
@Table(name = "task_dependencies")
public class TaskDependency implements Persistable<UUID> {

    @Id
    private UUID id;

    @Transient
    private boolean newEntity = true;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "predecessor_task_id", nullable = false)
    private UUID predecessorTaskId;

    @Column(name = "successor_task_id", nullable = false)
    private UUID successorTaskId;

    @Column(nullable = false)
    private String type;

    public static TaskDependency create(
            UUID organizationId, UUID predecessorTaskId, UUID successorTaskId, String type) {
        TaskDependency dependency = new TaskDependency();
        dependency.id = UUID.randomUUID();
        dependency.organizationId = organizationId;
        dependency.predecessorTaskId = predecessorTaskId;
        dependency.successorTaskId = successorTaskId;
        dependency.type = type != null && !type.isBlank() ? type : "FINISH_TO_START";
        return dependency;
    }

    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.newEntity = false;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getPredecessorTaskId() {
        return predecessorTaskId;
    }

    public UUID getSuccessorTaskId() {
        return successorTaskId;
    }

    public String getType() {
        return type;
    }
}
