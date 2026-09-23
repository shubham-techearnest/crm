package com.techearnest.crm.view.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "saved_views")
public class SavedView {

    @Id
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false, length = 32)
    private String module;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 16)
    private String visibility;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "filter_json", columnDefinition = "jsonb")
    private String filterJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "columns_json", columnDefinition = "jsonb")
    private String columnsJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sort_json", columnDefinition = "jsonb")
    private String sortJson;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public static SavedView create(
            UUID organizationId,
            UUID ownerId,
            String module,
            String name,
            String visibility,
            String filterJson,
            String columnsJson,
            String sortJson,
            boolean isDefault) {
        SavedView view = new SavedView();
        view.id = UUID.randomUUID();
        view.organizationId = organizationId;
        view.ownerId = ownerId;
        view.module = module;
        view.name = name;
        view.visibility = visibility == null || visibility.isBlank() ? "PRIVATE" : visibility;
        view.filterJson = filterJson;
        view.columnsJson = columnsJson;
        view.sortJson = sortJson;
        view.isDefault = isDefault;
        Instant now = Instant.now();
        view.createdAt = now;
        view.updatedAt = now;
        return view;
    }

    public void update(String name, String visibility, String filterJson, String columnsJson, String sortJson, Boolean isDefault) {
        if (name != null && !name.isBlank()) {
            this.name = name.trim();
        }
        if (visibility != null && !visibility.isBlank()) {
            this.visibility = visibility.trim().toUpperCase();
        }
        if (filterJson != null) {
            this.filterJson = filterJson;
        }
        if (columnsJson != null) {
            this.columnsJson = columnsJson;
        }
        if (sortJson != null) {
            this.sortJson = sortJson;
        }
        if (isDefault != null) {
            this.isDefault = isDefault;
        }
        this.updatedAt = Instant.now();
    }

    public void softDelete() {
        this.deletedAt = Instant.now();
        this.updatedAt = this.deletedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public String getModule() {
        return module;
    }

    public String getName() {
        return name;
    }

    public String getVisibility() {
        return visibility;
    }

    public String getFilterJson() {
        return filterJson;
    }

    public String getColumnsJson() {
        return columnsJson;
    }

    public String getSortJson() {
        return sortJson;
    }

    public boolean isDefault() {
        return isDefault;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
