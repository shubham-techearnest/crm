package com.techearnest.crm.expense.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class ExpenseFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("category", FieldMeta.of("category", String.class)),
            Map.entry("projectId", FieldMeta.of("projectId", UUID.class)),
            Map.entry("resourceId", FieldMeta.of("resourceId", UUID.class)),
            Map.entry("regionId", FieldMeta.of("regionId", UUID.class)),
            Map.entry("billable", FieldMeta.of("billable", Boolean.class)),
            Map.entry("expenseDate", FieldMeta.of("expenseDate", LocalDate.class)),
            Map.entry("amount", FieldMeta.of("amount", BigDecimal.class)),
            Map.entry("createdAt", FieldMeta.of("createdAt", Instant.class)));

    private ExpenseFilterFields() {}
}
