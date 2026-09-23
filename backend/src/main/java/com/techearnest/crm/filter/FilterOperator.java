package com.techearnest.crm.filter;

import java.util.Locale;

public enum FilterOperator {
    EQ,
    NE,
    CONTAINS,
    NOT_CONTAINS,
    STARTS_WITH,
    ENDS_WITH,
    GT,
    GTE,
    LT,
    LTE,
    IN,
    NOT_IN,
    IS_EMPTY,
    IS_NOT_EMPTY,
    BETWEEN;

    public static FilterOperator from(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Filter operator is required");
        }
        return FilterOperator.valueOf(raw.trim().toUpperCase(Locale.ROOT).replace(' ', '_'));
    }
}
