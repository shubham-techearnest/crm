package com.techearnest.crm.project.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.domain.Persistable;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "milestones")
@EntityListeners(AuditingEntityListener.class)
public class Milestone implements Persistable<UUID> {

    @Id
    private UUID id;

    @Transient
    private boolean newEntity = true;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(nullable = false)
    private String status;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private UUID updatedBy;

    public static Milestone create(
            UUID organizationId,
            UUID projectId,
            String name,
            String description,
            LocalDate dueDate,
            String status,
            Integer sortOrder) {
        Milestone milestone = new Milestone();
        milestone.id = UUID.randomUUID();
        milestone.organizationId = organizationId;
        milestone.projectId = projectId;
        milestone.name = name;
        milestone.description = description;
        milestone.dueDate = dueDate;
        milestone.status = status != null && !status.isBlank() ? status : "PLANNED";
        milestone.sortOrder = sortOrder != null ? sortOrder : 0;
        return milestone;
    }

    public void update(String name, String description, LocalDate dueDate, String status, Integer sortOrder) {
        if (name != null && !name.isBlank()) {
            this.name = name;
        }
        this.description = description;
        this.dueDate = dueDate;
        if (status != null && !status.isBlank()) {
            this.status = status;
        }
        if (sortOrder != null) {
            this.sortOrder = sortOrder;
        }
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
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

    public UUID getProjectId() {
        return projectId;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public String getStatus() {
        return status;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
