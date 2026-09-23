package com.techearnest.crm.project.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Project fields accepted by list/query filters. */
public final class ProjectFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("accountId", FieldMeta.of("accountId", UUID.class)),
            Map.entry("projectManagerId", FieldMeta.of("projectManagerId", UUID.class)),
            Map.entry("startDate", FieldMeta.of("startDate", LocalDate.class)),
            Map.entry("endDate", FieldMeta.of("endDate", LocalDate.class)));

    private ProjectFilterFields() {}
}
