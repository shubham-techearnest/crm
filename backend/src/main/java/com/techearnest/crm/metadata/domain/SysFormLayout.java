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
@Table(name = "sys_form_layout")
public class SysFormLayout {

    @Id
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "table_id", nullable = false)
    private UUID tableId;

    @Column(name = "layout_key", nullable = false, length = 32)
    private String layoutKey;

    @Column(nullable = false, length = 16)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "layout_json", nullable = false, columnDefinition = "jsonb")
    private String layoutJson;

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

    public static SysFormLayout createDraft(
            UUID organizationId,
            UUID tableId,
            String layoutKey,
            String layoutJson,
            UUID createdBy) {
        SysFormLayout layout = new SysFormLayout();
        layout.id = UUID.randomUUID();
        layout.organizationId = organizationId;
        layout.tableId = tableId;
        layout.layoutKey = layoutKey;
        layout.status = "DRAFT";
        layout.layoutJson = layoutJson;
        layout.version = 1;
        Instant now = Instant.now();
        layout.createdAt = now;
        layout.updatedAt = now;
        layout.createdBy = createdBy;
        layout.updatedBy = createdBy;
        return layout;
    }

    public void updateDraft(String layoutJson, UUID updatedBy) {
        this.layoutJson = layoutJson;
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }

    public void publish(UUID updatedBy) {
        this.status = "PUBLISHED";
        this.publishedAt = Instant.now();
        this.updatedBy = updatedBy;
        this.updatedAt = this.publishedAt;
    }

    public void markSuperseded(UUID updatedBy) {
        this.status = "SUPERSEDED";
        this.updatedBy = updatedBy;
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

    public String getStatus() {
        return status;
    }

    public String getLayoutJson() {
        return layoutJson;
    }

    public int getVersion() {
        return version;
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
