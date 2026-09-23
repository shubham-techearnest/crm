package com.techearnest.crm.procurement.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class VendorFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("regionId", FieldMeta.of("regionId", UUID.class)),
            Map.entry("name", FieldMeta.of("name", String.class)),
            Map.entry("email", FieldMeta.of("email", String.class)),
            Map.entry("taxNumber", FieldMeta.of("taxNumber", String.class)),
            Map.entry("createdAt", FieldMeta.of("createdAt", Instant.class)));

    private VendorFilterFields() {}
}
