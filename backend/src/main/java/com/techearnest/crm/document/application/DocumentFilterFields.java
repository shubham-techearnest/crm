package com.techearnest.crm.document.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Document fields accepted by list/query filters. */
public final class DocumentFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("entityType", FieldMeta.of("entityType", String.class)),
            Map.entry("visibility", FieldMeta.of("visibility", String.class)),
            Map.entry("uploadedBy", FieldMeta.of("uploadedBy", UUID.class)),
            Map.entry("createdAt", FieldMeta.of("createdAt", Instant.class)));

    private DocumentFilterFields() {}
}
