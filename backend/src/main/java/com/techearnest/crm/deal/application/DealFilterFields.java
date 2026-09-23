package com.techearnest.crm.deal.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Deal fields accepted by list/query filters. */
public final class DealFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("stage", FieldMeta.of("stage", String.class)),
            Map.entry("value", FieldMeta.of("value", BigDecimal.class)),
            Map.entry("expectedCloseDate", FieldMeta.of("expectedCloseDate", LocalDate.class)),
            Map.entry("accountId", FieldMeta.of("accountId", UUID.class)),
            Map.entry("ownerId", FieldMeta.of("ownerId", UUID.class)));

    private DealFilterFields() {}
}
