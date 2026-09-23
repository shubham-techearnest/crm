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
@Table(name = "sys_related_list_layout")
public class SysRelatedListLayout {

    @Id
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "parent_table_id", nullable = false)
    private UUID parentTableId;

    @Column(name = "child_table_code", nullable = false, length = 64)
    private String childTableCode;

    @Column(nullable = false, length = 128)
    private String label;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "permission_code", length = 64)
    private String permissionCode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "columns_json", nullable = false, columnDefinition = "jsonb")
    private String columnsJson = "[]";

    @Column(nullable = false, length = 16)
    private String status;

    @Column(nullable = false)
    private boolean active = true;

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

    public static SysRelatedListLayout createDraft(
            UUID orgId,
            UUID parentTableId,
            String childTableCode,
            String label,
            int sortOrder,
            String permissionCode,
            String columnsJson,
            UUID userId) {
        SysRelatedListLayout row = new SysRelatedListLayout();
        row.id = UUID.randomUUID();
        row.organizationId = orgId;
        row.parentTableId = parentTableId;
        row.childTableCode = childTableCode;
        row.label = label;
        row.sortOrder = sortOrder;
        row.permissionCode = permissionCode;
        row.columnsJson = columnsJson;
        row.status = "DRAFT";
        row.active = true;
        Instant now = Instant.now();
        row.createdAt = now;
        row.updatedAt = now;
        row.createdBy = userId;
        row.updatedBy = userId;
        return row;
    }

    public void update(
            String label,
            Integer sortOrder,
            String permissionCode,
            String columnsJson,
            Boolean active,
            UUID userId) {
        if (label != null && !label.isBlank()) {
            this.label = label.trim();
        }
        if (sortOrder != null) {
            this.sortOrder = sortOrder;
        }
        this.permissionCode = permissionCode;
        if (columnsJson != null) {
            this.columnsJson = columnsJson;
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

    public UUID getParentTableId() {
        return parentTableId;
    }

    public String getChildTableCode() {
        return childTableCode;
    }

    public String getLabel() {
        return label;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public String getPermissionCode() {
        return permissionCode;
    }

    public String getColumnsJson() {
        return columnsJson;
    }

    public String getStatus() {
        return status;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }
}
