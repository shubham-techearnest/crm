package com.techearnest.crm.common.csv;

import java.util.regex.Pattern;

public final class CsvCells {

    private static final Pattern PLAIN_NUMBER = Pattern.compile("[-+]?\\d+(\\.\\d+)?");

    private CsvCells() {}

    /**
     * Escapes a value for a CSV cell. Values that spreadsheet apps would evaluate as a formula
     * ({@code = + - @}, tab, CR) are prefixed with {@code '} so exported user input cannot run.
     */
    public static String escape(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        String safe = isFormulaLike(value) ? "'" + value : value;
        String escaped = safe.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\"") || escaped.contains("\n") || escaped.contains("\r")) {
            return "\"" + escaped + "\"";
        }
        return escaped;
    }

    private static boolean isFormulaLike(String value) {
        char first = value.charAt(0);
        boolean trigger = first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r';
        return trigger && !PLAIN_NUMBER.matcher(value).matches();
    }
}
