package com.techearnest.crm.platform.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class ProspectFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("stage", FieldMeta.of("stage", String.class)),
            Map.entry("source", FieldMeta.of("source", String.class)),
            Map.entry("name", FieldMeta.of("name", String.class)),
            Map.entry("ownerUserId", FieldMeta.of("ownerUserId", UUID.class)),
            Map.entry("estimatedArr", FieldMeta.of("estimatedArr", BigDecimal.class)),
            Map.entry("createdAt", FieldMeta.of("createdAt", Instant.class)),
            Map.entry("linkedOrganizationId", FieldMeta.of("linkedOrganizationId", UUID.class)));

    private ProspectFilterFields() {}
}
