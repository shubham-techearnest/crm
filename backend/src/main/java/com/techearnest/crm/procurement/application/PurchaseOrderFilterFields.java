package com.techearnest.crm.procurement.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class PurchaseOrderFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("vendorId", FieldMeta.of("vendorId", UUID.class)),
            Map.entry("projectId", FieldMeta.of("projectId", UUID.class)),
            Map.entry("regionId", FieldMeta.of("regionId", UUID.class)),
            Map.entry("total", FieldMeta.of("total", BigDecimal.class)),
            Map.entry("neededBy", FieldMeta.of("neededBy", LocalDate.class)),
            Map.entry("poNumber", FieldMeta.of("poNumber", String.class)),
            Map.entry("createdAt", FieldMeta.of("createdAt", Instant.class)));

    private PurchaseOrderFilterFields() {}
}
