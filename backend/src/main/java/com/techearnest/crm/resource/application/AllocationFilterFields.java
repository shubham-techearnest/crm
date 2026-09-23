package com.techearnest.crm.resource.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Allocation fields accepted by list/query filters. */
public final class AllocationFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("projectId", FieldMeta.of("projectId", UUID.class)),
            Map.entry("resourceId", FieldMeta.of("resourceId", UUID.class)),
            Map.entry("status", FieldMeta.of("status", String.class)));

    private AllocationFilterFields() {}
}
