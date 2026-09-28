package com.techearnest.crm.audit.application;

import java.math.BigDecimal;
import java.util.Objects;

/** Builds JSON summaries stored in audit_logs.new_value for timeline views. */
public final class AuditFieldChanges {

    private AuditFieldChanges() {}

    public static final class Builder {
        private final StringBuilder items = new StringBuilder();
        private boolean first = true;

        public Builder addIfChanged(String field, String label, Object before, Object after) {
            if (Objects.equals(normalize(before), normalize(after))) {
                return this;
            }
            if (!first) {
                items.append(',');
            }
            first = false;
            items.append("{\"field\":")
                    .append(jsonString(field))
                    .append(",\"label\":")
                    .append(jsonString(label))
                    .append(",\"from\":")
                    .append(jsonValue(before))
                    .append(",\"to\":")
                    .append(jsonValue(after))
                    .append('}');
            return this;
        }

        public boolean hasChanges() {
            return !first;
        }

        public String toJson() {
            if (!hasChanges()) {
                return null;
            }
            return "{\"changes\":[" + items + "]}";
        }
    }

    public static Builder builder() {
        return new Builder();
    }

    public static String expectedRevenue(BigDecimal amount, BigDecimal probability) {
        if (amount == null || probability == null) {
            return null;
        }
        return amount.multiply(probability).movePointLeft(2).stripTrailingZeros().toPlainString();
    }

    private static Object normalize(Object value) {
        if (value instanceof BigDecimal decimal) {
            return decimal.stripTrailingZeros();
        }
        if (value instanceof String string) {
            return string.isBlank() ? null : string.trim();
        }
        return value;
    }

    private static String jsonString(String value) {
        if (value == null) {
            return "null";
        }
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static String jsonValue(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof Number) {
            return value.toString();
        }
        return jsonString(String.valueOf(value));
    }
}
