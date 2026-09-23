package com.techearnest.crm.metadata.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "sys_form_policy")
public class SysFormPolicy {

    @Id
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "table_id", nullable = false)
    private UUID tableId;

    @Column(name = "layout_key", nullable = false, length = 32)
    private String layoutKey;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(nullable = false, length = 16)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "policy_json", nullable = false, columnDefinition = "jsonb")
    private String policyJson;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private int version = 1;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    public static SysFormPolicy createDraft(
            UUID orgId, UUID tableId, String layoutKey, String name, String policyJson, UUID userId) {
        SysFormPolicy p = new SysFormPolicy();
        p.id = UUID.randomUUID();
        p.organizationId = orgId;
        p.tableId = tableId;
        p.layoutKey = layoutKey;
        p.name = name;
        p.status = "DRAFT";
        p.policyJson = policyJson;
        p.active = true;
        Instant now = Instant.now();
        p.createdAt = now;
        p.updatedAt = now;
        p.createdBy = userId;
        p.updatedBy = userId;
        return p;
    }

    public void updateDraft(String name, String policyJson, Boolean active, UUID userId) {
        if (name != null && !name.isBlank()) {
            this.name = name.trim();
        }
        if (policyJson != null) {
            this.policyJson = policyJson;
        }
        if (active != null) {
            this.active = active;
        }
        this.updatedBy = userId;
        this.updatedAt = Instant.now();
    }

    public void publish(UUID userId) {
        this.status = "PUBLISHED";
        this.publishedAt = Instant.now();
        this.updatedBy = userId;
        this.updatedAt = this.publishedAt;
    }

    public void markSuperseded(UUID userId) {
        this.status = "SUPERSEDED";
        this.updatedBy = userId;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getTableId() {
        return tableId;
    }

    public String getLayoutKey() {
        return layoutKey;
    }

    public String getName() {
        return name;
    }

    public String getStatus() {
        return status;
    }

    public String getPolicyJson() {
        return policyJson;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }
}
