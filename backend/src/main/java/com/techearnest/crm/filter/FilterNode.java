package com.techearnest.crm.filter;

import java.util.List;

/**
 * Unified filter node. Leaf: {@code field}+{@code operator}+{@code value}.
 * Group: {@code op} (AND/OR) + {@code conditions}.
 */
public record FilterNode(
        String op, List<FilterNode> conditions, String field, String operator, Object value, Object valueTo) {

    public boolean isGroup() {
        return conditions != null && !conditions.isEmpty();
    }

    public String groupOp() {
        if (op == null || op.isBlank()) {
            return "AND";
        }
        return op.trim().toUpperCase();
    }
}
