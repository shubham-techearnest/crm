package com.techearnest.crm.finance.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class InvoiceFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("accountId", FieldMeta.of("accountId", UUID.class)),
            Map.entry("projectId", FieldMeta.of("projectId", UUID.class)),
            Map.entry("regionId", FieldMeta.of("regionId", UUID.class)),
            Map.entry("dueDate", FieldMeta.of("dueDate", LocalDate.class)),
            Map.entry("issueDate", FieldMeta.of("issueDate", LocalDate.class)),
            Map.entry("balanceDue", FieldMeta.of("balanceDue", BigDecimal.class)),
            Map.entry("total", FieldMeta.of("total", BigDecimal.class)),
            Map.entry("invoiceNumber", FieldMeta.of("invoiceNumber", String.class)),
            Map.entry("createdAt", FieldMeta.of("createdAt", Instant.class)));

    private InvoiceFilterFields() {}
}
