package com.techearnest.crm.project.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Project Task fields accepted by list/query filters. */
public final class TaskFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("projectId", FieldMeta.of("projectId", UUID.class)),
            Map.entry("assignedResourceId", FieldMeta.of("assignedResourceId", UUID.class)),
            Map.entry("dueDate", FieldMeta.of("dueDate", LocalDate.class)),
            Map.entry("priority", FieldMeta.of("priority", String.class)));

    private TaskFilterFields() {}
}
