package com.techearnest.crm.metadata.api.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.techearnest.crm.metadata.domain.SysField;
import com.techearnest.crm.metadata.domain.SysFormLayout;
import com.techearnest.crm.metadata.domain.SysListLayout;
import com.techearnest.crm.metadata.domain.SysTable;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class MetadataDtos {

    private MetadataDtos() {}

    public record SysTableResponse(
            UUID id,
            UUID organizationId,
            String code,
            String label,
            String plural,
            String moduleGroup,
            boolean active,
            boolean system,
            Instant createdAt,
            Instant updatedAt) {
        public static SysTableResponse from(SysTable table) {
            return new SysTableResponse(
                    table.getId(),
                    table.getOrganizationId(),
                    table.getCode(),
                    table.getLabel(),
                    table.getPlural(),
                    table.getModuleGroup(),
                    table.isActive(),
                    table.isSystem(),
                    table.getCreatedAt(),
                    table.getUpdatedAt());
        }
    }

    public record UpdateTableRequest(
            @Size(max = 128) String label, @Size(max = 128) String plural, Boolean active) {}

    public record SysFieldResponse(
            UUID id,
            UUID organizationId,
            UUID tableId,
            String code,
            String label,
            String helpText,
            String fieldType,
            boolean mandatory,
            String defaultValue,
            String referenceTableCode,
            boolean active,
            boolean filterable,
            boolean system,
            int sortOrder,
            Instant createdAt,
            Instant updatedAt) {
        public static SysFieldResponse from(SysField field) {
            return new SysFieldResponse(
                    field.getId(),
                    field.getOrganizationId(),
                    field.getTableId(),
                    field.getCode(),
                    field.getLabel(),
                    field.getHelpText(),
                    field.getFieldType(),
                    field.isMandatory(),
                    field.getDefaultValue(),
                    field.getReferenceTableCode(),
                    field.isActive(),
                    field.isFilterable(),
                    field.isSystem(),
                    field.getSortOrder(),
                    field.getCreatedAt(),
                    field.getUpdatedAt());
        }
    }

    public record CreateFieldRequest(
            @NotBlank @Size(max = 64) String code,
            @NotBlank @Size(max = 128) String label,
            @Size(max = 512) String helpText,
            @NotBlank @Size(max = 32) String fieldType,
            Boolean mandatory,
            @Size(max = 512) String defaultValue,
            @Size(max = 64) String referenceTableCode,
            Boolean filterable,
            Integer sortOrder) {}

    public record UpdateFieldRequest(
            @Size(max = 128) String label,
            @Size(max = 512) String helpText,
            @Size(max = 32) String fieldType,
            Boolean mandatory,
            @Size(max = 512) String defaultValue,
            @Size(max = 64) String referenceTableCode,
            Boolean active,
            Boolean filterable,
            Integer sortOrder) {}

    public record FilterFieldCatalogItem(String code, String label, String fieldType, String referenceTableCode) {}

    public record FormLayoutResponse(
            UUID id,
            UUID organizationId,
            UUID tableId,
            String layoutKey,
            String status,
            JsonNode layout,
            int version,
            Instant createdAt,
            Instant updatedAt,
            Instant publishedAt) {
        public static FormLayoutResponse from(SysFormLayout layout, JsonNode json) {
            return new FormLayoutResponse(
                    layout.getId(),
                    layout.getOrganizationId(),
                    layout.getTableId(),
                    layout.getLayoutKey(),
                    layout.getStatus(),
                    json,
                    layout.getVersion(),
                    layout.getCreatedAt(),
                    layout.getUpdatedAt(),
                    layout.getPublishedAt());
        }
    }

    public record SaveFormLayoutRequest(
            @NotBlank @Size(max = 32) String layoutKey, @NotNull JsonNode layout) {}

    public record ListLayoutResponse(
            UUID id,
            UUID organizationId,
            UUID tableId,
            UUID roleId,
            String status,
            JsonNode layout,
            int version,
            Instant createdAt,
            Instant updatedAt,
            Instant publishedAt) {
        public static ListLayoutResponse from(SysListLayout layout, JsonNode json) {
            return new ListLayoutResponse(
                    layout.getId(),
                    layout.getOrganizationId(),
                    layout.getTableId(),
                    layout.getRoleId(),
                    layout.getStatus(),
                    json,
                    layout.getVersion(),
                    layout.getCreatedAt(),
                    layout.getUpdatedAt(),
                    layout.getPublishedAt());
        }
    }

    public record SaveListLayoutRequest(UUID roleId, @NotNull JsonNode layout) {}

    public record RuntimeFormBundleResponse(FormLayoutResponse layout, java.util.List<SysFieldResponse> fields) {}

    public record UserListPrefResponse(String tableCode, JsonNode columns) {}

    public record FormPolicyResponse(
            UUID id,
            UUID organizationId,
            UUID tableId,
            String layoutKey,
            String name,
            String status,
            JsonNode policy,
            boolean active,
            Instant publishedAt) {}

    public record SaveFormPolicyRequest(
            @NotBlank @Size(max = 128) String name,
            @Size(max = 32) String layoutKey,
            @NotNull JsonNode policy,
            Boolean active) {}

    public record RelatedListResponse(
            UUID id,
            UUID organizationId,
            UUID parentTableId,
            String childTableCode,
            String label,
            int sortOrder,
            String permissionCode,
            JsonNode columns,
            String status,
            boolean active) {}

    public record SaveRelatedListRequest(
            @NotBlank @Size(max = 64) String childTableCode,
            @NotBlank @Size(max = 128) String label,
            Integer sortOrder,
            @Size(max = 64) String permissionCode,
            JsonNode columns,
            Boolean active) {}

    public record TableAclResponse(
            UUID id,
            UUID organizationId,
            UUID roleId,
            UUID tableId,
            String tableCode,
            String roleCode,
            boolean canCreate,
            boolean canRead,
            boolean canUpdate,
            boolean canDelete) {}

    public record UpsertTableAclRequest(
            @NotNull UUID roleId,
            @NotNull UUID tableId,
            boolean canCreate,
            boolean canRead,
            boolean canUpdate,
            boolean canDelete) {}

    public record FieldAclResponse(
            UUID id,
            UUID organizationId,
            UUID roleId,
            UUID fieldId,
            String tableCode,
            String fieldCode,
            String roleCode,
            String accessLevel) {}

    public record UpsertFieldAclRequest(
            @NotNull UUID roleId, @NotNull UUID fieldId, @NotBlank @Size(max = 16) String accessLevel) {}
}
