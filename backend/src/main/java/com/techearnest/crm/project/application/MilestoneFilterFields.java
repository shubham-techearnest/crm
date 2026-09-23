package com.techearnest.crm.project.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Milestone fields accepted by list/query filters. */
public final class MilestoneFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("projectId", FieldMeta.of("projectId", UUID.class)),
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("dueDate", FieldMeta.of("dueDate", LocalDate.class)));

    private MilestoneFilterFields() {}
}
