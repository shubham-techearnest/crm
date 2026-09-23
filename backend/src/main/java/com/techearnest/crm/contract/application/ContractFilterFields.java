package com.techearnest.crm.contract.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class ContractFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("accountId", FieldMeta.of("accountId", UUID.class)),
            Map.entry("projectId", FieldMeta.of("projectId", UUID.class)),
            Map.entry("regionId", FieldMeta.of("regionId", UUID.class)),
            Map.entry("autoRenew", FieldMeta.of("autoRenew", Boolean.class)),
            Map.entry("endDate", FieldMeta.of("endDate", LocalDate.class)),
            Map.entry("startDate", FieldMeta.of("startDate", LocalDate.class)),
            Map.entry("valueAmount", FieldMeta.of("valueAmount", BigDecimal.class)),
            Map.entry("createdAt", FieldMeta.of("createdAt", Instant.class)));

    private ContractFilterFields() {}
}
