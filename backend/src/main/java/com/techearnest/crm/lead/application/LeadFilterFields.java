package com.techearnest.crm.lead.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class LeadFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("source", FieldMeta.of("source", String.class)),
            Map.entry("priority", FieldMeta.of("priority", String.class)),
            Map.entry("industry", FieldMeta.of("industry", String.class)),
            Map.entry("regionId", FieldMeta.of("regionId", UUID.class)),
            Map.entry("ownerId", FieldMeta.of("ownerId", UUID.class)),
            Map.entry("email", FieldMeta.of("email", String.class)),
            Map.entry("companyName", FieldMeta.of("companyName", String.class)),
            Map.entry("firstName", FieldMeta.of("firstName", String.class)),
            Map.entry("lastName", FieldMeta.of("lastName", String.class)),
            Map.entry("estimatedValue", FieldMeta.of("estimatedValue", BigDecimal.class)),
            Map.entry("expectedCloseDate", FieldMeta.of("expectedCloseDate", LocalDate.class)),
            Map.entry("createdAt", FieldMeta.of("createdAt", Instant.class)));

    private LeadFilterFields() {}
}
