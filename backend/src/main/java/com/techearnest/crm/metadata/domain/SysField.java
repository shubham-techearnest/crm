package com.techearnest.crm.metadata.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sys_field")
public class SysField {

    @Id
    private UUID id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "table_id", nullable = false)
    private UUID tableId;

    @Column(nullable = false, length = 64)
    private String code;

    @Column(nullable = false, length = 128)
    private String label;

    @Column(name = "help_text", length = 512)
    private String helpText;

    @Column(name = "field_type", nullable = false, length = 32)
    private String fieldType;

    @Column(nullable = false)
    private boolean mandatory;

    @Column(name = "default_value", length = 512)
    private String defaultValue;

    @Column(name = "reference_table_code", length = 64)
    private String referenceTableCode;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private boolean filterable = false;

    @Column(name = "is_system", nullable = false)
    private boolean system = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    public static SysField createCustom(
            UUID organizationId,
            UUID tableId,
            String code,
            String label,
            String helpText,
            String fieldType,
            boolean mandatory,
            String defaultValue,
            String referenceTableCode,
            int sortOrder,
            UUID createdBy) {
        SysField field = new SysField();
        field.id = UUID.randomUUID();
        field.organizationId = organizationId;
        field.tableId = tableId;
        field.code = code;
        field.label = label;
        field.helpText = helpText;
        field.fieldType = fieldType;
        field.mandatory = mandatory;
        field.defaultValue = defaultValue;
        field.referenceTableCode = referenceTableCode;
        field.active = true;
        field.filterable = false;
        field.system = false;
        field.sortOrder = sortOrder;
        field.createdAt = Instant.now();
        field.updatedAt = Instant.now();
        field.createdBy = createdBy;
        field.updatedBy = createdBy;
        return field;
    }

    public void updateSystemLabelHelp(String label, String helpText, UUID updatedBy) {
        if (label != null && !label.isBlank()) {
            this.label = label.trim();
        }
        this.helpText = helpText;
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }

    public void updateCustom(
            String label,
            String helpText,
            String fieldType,
            Boolean mandatory,
            String defaultValue,
            String referenceTableCode,
            Boolean active,
            Boolean filterable,
            Integer sortOrder,
            UUID updatedBy) {
        if (label != null && !label.isBlank()) {
            this.label = label.trim();
        }
        this.helpText = helpText;
        if (fieldType != null && !fieldType.isBlank()) {
            this.fieldType = fieldType.trim();
        }
        if (mandatory != null) {
            this.mandatory = mandatory;
        }
        this.defaultValue = defaultValue;
        this.referenceTableCode = referenceTableCode;
        if (active != null) {
            this.active = active;
        }
        if (filterable != null) {
            this.filterable = filterable;
        }
        if (sortOrder != null) {
            this.sortOrder = sortOrder;
        }
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }

    public void setFilterable(boolean filterable, UUID updatedBy) {
        this.filterable = filterable;
        this.updatedBy = updatedBy;
        this.updatedAt = Instant.now();
    }

    public void deactivate(UUID updatedBy) {
        this.active = false;
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

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    public String getHelpText() {
        return helpText;
    }

    public String getFieldType() {
        return fieldType;
    }

    public boolean isMandatory() {
        return mandatory;
    }

    public String getDefaultValue() {
        return defaultValue;
    }

    public String getReferenceTableCode() {
        return referenceTableCode;
    }

    public boolean isActive() {
        return active;
    }

    public boolean isFilterable() {
        return filterable;
    }

    public boolean isSystem() {
        return system;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
