package com.techearnest.crm.resource.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Resource fields accepted by list/query filters. */
public final class ResourceFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("regionId", FieldMeta.of("regionId", UUID.class)),
            Map.entry("skillId", FieldMeta.of("skillId", UUID.class)));

    private ResourceFilterFields() {}
}
