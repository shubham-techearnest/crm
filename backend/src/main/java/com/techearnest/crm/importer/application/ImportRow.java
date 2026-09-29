package com.techearnest.crm.importer.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/** Typed, validated access to one spreadsheet row. Every problem is reported as a {@link RowRejected}. */
public final class ImportRow {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final Map<String, String> cells;

    public ImportRow(Map<String, String> cells) {
        this.cells = cells == null ? Map.of() : cells;
    }

    public boolean isEmpty() {
        return cells.values().stream().allMatch(v -> v == null || v.isBlank());
    }

    public String text(String key) {
        String value = cells.get(key);
        return value == null || value.isBlank() ? null : value.trim();
    }

    public String required(String key, String label) {
        String value = text(key);
        if (value == null) {
            throw new RowRejected(label + " is required");
        }
        return value;
    }

    public String email(String key, String label) {
        String value = text(key);
        if (value != null && !EMAIL.matcher(value).matches()) {
            throw new RowRejected("Invalid " + label.toLowerCase(Locale.ROOT) + " '" + value + "'");
        }
        return value == null ? null : value.toLowerCase(Locale.ROOT);
    }

    public BigDecimal decimal(String key, String label) {
        String value = text(key);
        if (value == null) {
            return null;
        }
        try {
            BigDecimal number = new BigDecimal(value.replaceAll("[,\\s₹$€£]", ""));
            if (number.signum() < 0) {
                throw new RowRejected(label + " cannot be negative");
            }
            return number;
        } catch (NumberFormatException e) {
            throw new RowRejected(label + " '" + value + "' is not a valid number");
        }
    }

    public Integer integer(String key, String label) {
        BigDecimal number = decimal(key, label);
        if (number == null) {
            return null;
        }
        try {
            return number.intValueExact();
        } catch (ArithmeticException e) {
            throw new RowRejected(label + " '" + text(key) + "' must be a whole number");
        }
    }

    public Boolean bool(String key, String label) {
        String value = text(key);
        if (value == null) {
            return null;
        }
        return switch (value.toLowerCase(Locale.ROOT)) {
            case "true", "yes", "y", "1" -> Boolean.TRUE;
            case "false", "no", "n", "0" -> Boolean.FALSE;
            default -> throw new RowRejected(label + " '" + value + "' must be true/false or yes/no");
        };
    }

    public LocalDate date(String key, String label) {
        String value = text(key);
        if (value == null) {
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new RowRejected(label + " '" + value + "' is not a valid date (use YYYY-MM-DD)");
        }
    }

    /** Upper-cases and underscores the value ("On hold" → ON_HOLD) and checks it against the allowed codes. */
    public String code(String key, String label, Collection<String> allowed, String defaultValue) {
        String value = text(key);
        if (value == null) {
            return defaultValue;
        }
        String normalized = value.toUpperCase(Locale.ROOT).replaceAll("[\\s-]+", "_");
        if (!allowed.contains(normalized)) {
            throw new RowRejected("Unknown " + label.toLowerCase(Locale.ROOT) + " '" + value + "' (use "
                    + String.join(", ", allowed.stream().sorted().toList()) + ")");
        }
        return normalized;
    }
}
