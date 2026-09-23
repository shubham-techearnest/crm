package com.techearnest.crm.activity.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Activity fields accepted by list/query filters. */
public final class ActivityFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("type", FieldMeta.of("type", String.class)),
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("dueDate", FieldMeta.of("dueDate", Instant.class)),
            Map.entry("relatedEntityType", FieldMeta.of("relatedEntityType", String.class)),
            Map.entry("assignedTo", FieldMeta.of("assignedTo", UUID.class)),
            Map.entry("outcome", FieldMeta.of("outcome", String.class)),
            Map.entry("callDirection", FieldMeta.of("callDirection", String.class)));

    private ActivityFilterFields() {}
}
