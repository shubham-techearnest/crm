package com.techearnest.crm.metadata.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sys_table")
public class SysTable {

    @Id
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(nullable = false, length = 128)
    private String label;

    @Column(nullable = false, length = 128)
    private String plural;

    @Column(name = "module_group", nullable = false, length = 64)
    private String moduleGroup;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "is_system", nullable = false)
    private boolean system = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static SysTable createOrgOverride(
            UUID organizationId, String code, String label, String plural, String moduleGroup) {
        SysTable table = new SysTable();
        table.id = UUID.randomUUID();
        table.organizationId = organizationId;
        table.code = code;
        table.label = label;
        table.plural = plural;
        table.moduleGroup = moduleGroup;
        table.active = true;
        table.system = false;
        table.createdAt = Instant.now();
        table.updatedAt = Instant.now();
        return table;
    }

    public void updateLabel(String label, String plural, Boolean active) {
        if (label != null && !label.isBlank()) {
            this.label = label.trim();
        }
        if (plural != null && !plural.isBlank()) {
            this.plural = plural.trim();
        }
        if (active != null) {
            this.active = active;
        }
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    public String getPlural() {
        return plural;
    }

    public String getModuleGroup() {
        return moduleGroup;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isSystem() {
        return system;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
