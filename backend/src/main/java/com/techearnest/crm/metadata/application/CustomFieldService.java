package com.techearnest.crm.metadata.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techearnest.crm.audit.application.AuditService;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ForbiddenException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.DataScope;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.CustomFieldDefinition;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.CustomFieldSchemaResponse;
import com.techearnest.crm.metadata.api.dto.MetadataDtos.CustomFieldSection;
import com.techearnest.crm.metadata.domain.SysField;
import com.techearnest.crm.metadata.domain.SysFieldRepository;
import com.techearnest.crm.metadata.domain.SysFormLayout;
import com.techearnest.crm.metadata.domain.SysFormLayoutRepository;
import com.techearnest.crm.metadata.domain.SysTable;
import com.techearnest.crm.metadata.domain.SysTableRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Stores and validates values of Metadata Studio custom fields for records of any table. */
@Service
public class CustomFieldService {

    private static final TypeReference<LinkedHashMap<String, Object>> VALUES_TYPE = new TypeReference<>() {};
    private static final int MAX_STRING = 512;
    private static final int MAX_TEXT = 10_000;

    private final SysTableRepository sysTableRepository;
    private final SysFieldRepository sysFieldRepository;
    private final SysFormLayoutRepository formLayoutRepository;
    private final TableAclEvaluator tableAclEvaluator;
    private final FieldAclEvaluator fieldAclEvaluator;
    private final TenantAccess tenantAccess;
    private final AuditService auditService;
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public CustomFieldService(
            SysTableRepository sysTableRepository,
            SysFieldRepository sysFieldRepository,
            SysFormLayoutRepository formLayoutRepository,
            TableAclEvaluator tableAclEvaluator,
            FieldAclEvaluator fieldAclEvaluator,
            TenantAccess tenantAccess,
            AuditService auditService,
            NamedParameterJdbcTemplate jdbc,
            ObjectMapper objectMapper) {
        this.sysTableRepository = sysTableRepository;
        this.sysFieldRepository = sysFieldRepository;
        this.formLayoutRepository = formLayoutRepository;
        this.tableAclEvaluator = tableAclEvaluator;
        this.fieldAclEvaluator = fieldAclEvaluator;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public CustomFieldSchemaResponse schema(String tableCode, String layoutKey) {
        CurrentUser user = requireTenantUser();
        SysTable table = resolveBaseTable(user.organizationId(), tableCode);
        List<VisibleField> fields = visibleCustomFields(user.organizationId(), table);
        List<CustomFieldDefinition> definitions = fields.stream()
                .map(visible -> toDefinition(visible.field(), visible.access()))
                .toList();
        return new CustomFieldSchemaResponse(
                table.getCode(), definitions, sections(user.organizationId(), table, fields, layoutKey));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> values(String tableCode, UUID recordId) {
        return valuesFor(tableCode, List.of(recordId)).getOrDefault(recordId, Map.of());
    }

    @Transactional(readOnly = true)
    public Map<UUID, Map<String, Object>> valuesFor(String tableCode, Collection<UUID> recordIds) {
        CurrentUser user = requireTenantUser();
        SysTable table = resolveBaseTable(user.organizationId(), tableCode);
        requireTable(user, table.getCode(), TableAclEvaluator.CrudOp.READ);
        if (recordIds == null || recordIds.isEmpty()) {
            return Map.of();
        }
        Set<String> readable = new HashSet<>();
        for (VisibleField visible : visibleCustomFields(user.organizationId(), table)) {
            readable.add(visible.field().getCode());
        }
        Map<UUID, Map<String, Object>> stored = load(user.organizationId(), table.getCode(), recordIds);
        Map<UUID, Map<String, Object>> out = new LinkedHashMap<>();
        stored.forEach((recordId, values) -> {
            Map<String, Object> filtered = new LinkedHashMap<>();
            values.forEach((code, value) -> {
                if (readable.contains(code) && value != null) {
                    filtered.put(code, value);
                }
            });
            out.put(recordId, filtered);
        });
        return out;
    }

    @Transactional
    public Map<String, Object> save(String tableCode, UUID recordId, Map<String, Object> submitted) {
        CurrentUser user = requireTenantUser();
        UUID orgId = user.organizationId();
        SysTable table = resolveBaseTable(orgId, tableCode);
        if (!tableAclEvaluator.isAllowedWhenConfigured(user, table.getCode(), TableAclEvaluator.CrudOp.UPDATE)
                && !tableAclEvaluator.isAllowedWhenConfigured(user, table.getCode(), TableAclEvaluator.CrudOp.CREATE)) {
            throw new ForbiddenException("You do not have permission to change " + table.getPlural());
        }
        List<VisibleField> fields = visibleCustomFields(orgId, table);
        Map<String, VisibleField> byCode = new LinkedHashMap<>();
        fields.forEach(visible -> byCode.put(visible.field().getCode(), visible));

        Map<String, Object> current = new LinkedHashMap<>(
                load(orgId, table.getCode(), List.of(recordId)).getOrDefault(recordId, Map.of()));
        Map<String, Object> next = new LinkedHashMap<>(current);
        Map<String, Object> input = submitted == null ? Map.of() : submitted;
        for (Map.Entry<String, Object> entry : input.entrySet()) {
            VisibleField visible = byCode.get(entry.getKey());
            if (visible == null) {
                continue;
            }
            Object value = coerce(visible.field(), entry.getValue());
            if (sameValue(value, current.get(entry.getKey()))) {
                continue;
            }
            if (visible.access() != FieldAclEvaluator.Access.WRITE) {
                throw new ForbiddenException("You cannot change " + visible.field().getLabel());
            }
            if (value == null) {
                next.remove(entry.getKey());
            } else {
                next.put(entry.getKey(), value);
            }
        }
        List<String> missing = new ArrayList<>();
        for (VisibleField visible : fields) {
            SysField field = visible.field();
            if (field.isMandatory()
                    && visible.access() == FieldAclEvaluator.Access.WRITE
                    && isBlank(next.get(field.getCode()))) {
                missing.add(field.getLabel());
            }
        }
        if (!missing.isEmpty()) {
            throw new BusinessException("CUSTOM_FIELD_REQUIRED", String.join(", ", missing) + " is required");
        }
        if (!next.equals(current)) {
            upsert(orgId, table.getCode(), recordId, next, user.userId());
            auditService.recordWithSummary(
                    orgId,
                    user.userId(),
                    "UPDATE",
                    "CUSTOM_FIELDS",
                    recordId,
                    "{\"table\":\"" + table.getCode() + "\",\"fields\":" + writeJson(changedKeys(current, next)) + "}");
        }
        Map<String, Object> visibleValues = new LinkedHashMap<>();
        next.forEach((code, value) -> {
            if (byCode.containsKey(code)) {
                visibleValues.put(code, value);
            }
        });
        return visibleValues;
    }

    private record VisibleField(SysField field, FieldAclEvaluator.Access access) {}

    private List<VisibleField> visibleCustomFields(UUID orgId, SysTable table) {
        List<SysField> all = sysFieldRepository.findEffectiveForTable(orgId, table.getId());
        Set<String> systemCodes = new HashSet<>();
        for (SysField field : all) {
            if (field.isSystem()) {
                systemCodes.add(field.getCode());
            }
        }
        List<VisibleField> out = new ArrayList<>();
        for (SysField field : all) {
            if (field.isSystem()
                    || !field.isActive()
                    || field.getOrganizationId() == null
                    || systemCodes.contains(field.getCode())) {
                continue;
            }
            FieldAclEvaluator.Access access = fieldAclEvaluator.accessFor(table.getCode(), field.getCode());
            if (access != FieldAclEvaluator.Access.HIDDEN) {
                out.add(new VisibleField(field, access));
            }
        }
        return out;
    }

    private List<CustomFieldSection> sections(UUID orgId, SysTable table, List<VisibleField> fields, String layoutKey) {
        Set<String> remaining = new LinkedHashSet<>();
        fields.forEach(visible -> remaining.add(visible.field().getCode()));
        List<CustomFieldSection> sections = new ArrayList<>();
        JsonNode layout = publishedLayout(orgId, table.getId(), layoutKey);
        if (layout != null && layout.path("sections").isArray()) {
            for (JsonNode section : layout.path("sections")) {
                List<String> placed = new ArrayList<>();
                for (JsonNode code : section.path("fields")) {
                    if (remaining.remove(code.asText())) {
                        placed.add(code.asText());
                    }
                }
                if (!placed.isEmpty()) {
                    sections.add(new CustomFieldSection(
                            section.path("id").asText("section-" + sections.size()),
                            section.path("title").asText("Additional Information"),
                            section.path("disclosure").asText("ALWAYS"),
                            placed));
                }
            }
        }
        if (!remaining.isEmpty()) {
            sections.add(new CustomFieldSection(
                    "custom-fields", "Additional Information", "ALWAYS", new ArrayList<>(remaining)));
        }
        return sections;
    }

    private JsonNode publishedLayout(UUID orgId, UUID tableId, String layoutKey) {
        String key = "EDIT".equalsIgnoreCase(layoutKey) ? "EDIT" : "CREATE";
        List<SysFormLayout> layouts = formLayoutRepository.findPublished(orgId, tableId, key);
        if (layouts.isEmpty() && key.equals("EDIT")) {
            layouts = formLayoutRepository.findPublished(orgId, tableId, "CREATE");
        }
        if (layouts.isEmpty()) {
            return null;
        }
        try {
            String raw = layouts.get(0).getLayoutJson();
            return objectMapper.readTree(raw == null || raw.isBlank() ? "{}" : raw);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private Object coerce(SysField field, Object raw) {
        if (raw == null || (raw instanceof String text && text.isBlank())) {
            return null;
        }
        String label = field.getLabel();
        String type = field.getFieldType() == null ? "STRING" : field.getFieldType().toUpperCase(Locale.ROOT);
        return switch (type) {
            case "NUMBER" -> {
                try {
                    BigDecimal number = raw instanceof Number n ? new BigDecimal(n.toString()) : new BigDecimal(raw.toString().trim());
                    yield number.stripTrailingZeros().scale() <= 0 ? number.toBigInteger() : number;
                } catch (NumberFormatException e) {
                    throw invalid(label, "must be a number");
                }
            }
            case "BOOLEAN" -> {
                if (raw instanceof Boolean bool) {
                    yield bool;
                }
                String text = raw.toString().trim().toLowerCase(Locale.ROOT);
                if (text.equals("true") || text.equals("yes")) {
                    yield Boolean.TRUE;
                }
                if (text.equals("false") || text.equals("no")) {
                    yield Boolean.FALSE;
                }
                throw invalid(label, "must be true or false");
            }
            case "DATE" -> {
                try {
                    yield LocalDate.parse(raw.toString().trim()).toString();
                } catch (DateTimeParseException e) {
                    throw invalid(label, "must be a date (YYYY-MM-DD)");
                }
            }
            case "DATETIME" -> {
                String text = raw.toString().trim();
                try {
                    yield OffsetDateTime.parse(text).toString();
                } catch (DateTimeParseException ignored) {
                    try {
                        yield LocalDateTime.parse(text).toString();
                    } catch (DateTimeParseException e) {
                        throw invalid(label, "must be a date and time");
                    }
                }
            }
            case "REFERENCE" -> {
                try {
                    yield UUID.fromString(raw.toString().trim()).toString();
                } catch (IllegalArgumentException e) {
                    throw invalid(label, "must reference a record");
                }
            }
            case "ENUM" -> {
                String text = raw.toString().trim();
                List<String> options = field.optionList();
                if (!options.isEmpty() && !options.contains(text)) {
                    throw invalid(label, "must be one of: " + String.join(", ", options));
                }
                yield text;
            }
            case "TEXT" -> limit(label, raw.toString(), MAX_TEXT);
            default -> limit(label, raw.toString().trim(), MAX_STRING);
        };
    }

    private static String limit(String label, String text, int max) {
        if (text.length() > max) {
            throw invalid(label, "must be at most " + max + " characters");
        }
        return text;
    }

    private static BusinessException invalid(String label, String problem) {
        return new BusinessException("INVALID_CUSTOM_FIELD", label + " " + problem);
    }

    private static boolean sameValue(Object left, Object right) {
        if (left instanceof Number a && right instanceof Number b) {
            return new BigDecimal(a.toString()).compareTo(new BigDecimal(b.toString())) == 0;
        }
        return Objects.equals(left, right);
    }

    private static boolean isBlank(Object value) {
        return value == null || (value instanceof String text && text.isBlank());
    }

    private static List<String> changedKeys(Map<String, Object> before, Map<String, Object> after) {
        Set<String> keys = new LinkedHashSet<>(before.keySet());
        keys.addAll(after.keySet());
        return keys.stream().filter(key -> !sameValue(before.get(key), after.get(key))).toList();
    }

    private Map<UUID, Map<String, Object>> load(UUID orgId, String tableCode, Collection<UUID> recordIds) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("orgId", orgId)
                .addValue("tableCode", tableCode)
                .addValue("ids", new ArrayList<>(new LinkedHashSet<>(recordIds)));
        Map<UUID, Map<String, Object>> out = new HashMap<>();
        jdbc.query(
                """
                select record_id, field_values::text as field_values
                from custom_field_values
                where organization_id = :orgId and table_code = :tableCode and record_id in (:ids)
                """,
                params,
                rs -> {
                    out.put(rs.getObject("record_id", UUID.class), readJson(rs.getString("field_values")));
                });
        return out;
    }

    private void upsert(UUID orgId, String tableCode, UUID recordId, Map<String, Object> values, UUID userId) {
        jdbc.update(
                """
                insert into custom_field_values (organization_id, table_code, record_id, field_values, updated_at, updated_by)
                values (:orgId, :tableCode, :recordId, cast(:values as jsonb), now(), :userId)
                on conflict (organization_id, table_code, record_id)
                do update set field_values = excluded.field_values, updated_at = now(), updated_by = excluded.updated_by
                """,
                new MapSqlParameterSource()
                        .addValue("orgId", orgId)
                        .addValue("tableCode", tableCode)
                        .addValue("recordId", recordId)
                        .addValue("values", writeJson(values))
                        .addValue("userId", userId));
    }

    private Map<String, Object> readJson(String raw) {
        try {
            return raw == null || raw.isBlank() ? new LinkedHashMap<>() : objectMapper.readValue(raw, VALUES_TYPE);
        } catch (JsonProcessingException e) {
            return new LinkedHashMap<>();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new BusinessException("INVALID_CUSTOM_FIELD", "Custom field values could not be stored");
        }
    }

    private CustomFieldDefinition toDefinition(SysField field, FieldAclEvaluator.Access access) {
        return new CustomFieldDefinition(
                field.getCode(),
                field.getLabel(),
                field.getHelpText(),
                field.getFieldType(),
                field.isMandatory(),
                field.getDefaultValue(),
                field.getReferenceTableCode(),
                field.optionList(),
                field.getSortOrder(),
                access.name());
    }

    private SysTable resolveBaseTable(UUID orgId, String tableCode) {
        String code = tableCode == null ? "" : tableCode.trim();
        List<SysTable> lower = sysTableRepository.findByCodePreferringOrg(orgId, code.toLowerCase(Locale.ROOT));
        List<SysTable> tables = lower.isEmpty() ? sysTableRepository.findByCodePreferringOrg(orgId, code) : lower;
        return tables.stream()
                .filter(table -> table.getOrganizationId() == null)
                .findFirst()
                .or(() -> tables.stream().findFirst())
                .orElseThrow(() -> new ResourceNotFoundException("Table not found"));
    }

    private void requireTable(CurrentUser user, String tableCode, TableAclEvaluator.CrudOp op) {
        if (!tableAclEvaluator.isAllowedWhenConfigured(user, tableCode, op)) {
            throw new ForbiddenException("You do not have permission to view this data");
        }
    }

    private CurrentUser requireTenantUser() {
        CurrentUser user = tenantAccess.currentUser();
        if (user.dataScope() == DataScope.PLATFORM || user.organizationId() == null) {
            throw new ForbiddenException("Custom fields are available to organization users only");
        }
        return user;
    }
}
