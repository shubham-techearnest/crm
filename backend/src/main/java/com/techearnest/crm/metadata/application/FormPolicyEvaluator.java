package com.techearnest.crm.metadata.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.techearnest.crm.common.exception.BusinessException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Declarative form policy evaluator (no scripts). */
@Component
public class FormPolicyEvaluator {

    public record FieldEffect(String field, boolean visible, boolean mandatory, boolean readOnly) {}

    public List<FieldEffect> evaluate(List<JsonNode> policies, Map<String, Object> values) {
        List<FieldEffect> effects = new ArrayList<>();
        for (JsonNode policy : policies) {
            JsonNode when = policy.get("when");
            JsonNode then = policy.get("then");
            if (when == null || then == null || !then.isArray()) {
                continue;
            }
            if (!matches(when, values)) {
                continue;
            }
            for (JsonNode action : then) {
                String field = text(action, "field");
                if (field == null) {
                    continue;
                }
                effects.add(new FieldEffect(
                        field,
                        action.path("visible").asBoolean(true),
                        action.path("mandatory").asBoolean(false),
                        action.path("readOnly").asBoolean(false)));
            }
        }
        return effects;
    }

    public void assertMandatory(List<JsonNode> policies, Map<String, Object> values) {
        for (FieldEffect effect : evaluate(policies, values)) {
            if (!effect.mandatory()) {
                continue;
            }
            Object raw = values.get(effect.field());
            if (raw == null || String.valueOf(raw).isBlank()) {
                throw new BusinessException(
                        "POLICY_MANDATORY", "Field '" + effect.field() + "' is required by form policy");
            }
        }
    }

    private boolean matches(JsonNode when, Map<String, Object> values) {
        String field = text(when, "field");
        String op = text(when, "op");
        if (field == null || op == null) {
            return false;
        }
        Object actual = values.get(field);
        String expected = when.path("value").isMissingNode() ? null : when.path("value").asText(null);
        String actualText = actual == null ? null : String.valueOf(actual);
        return switch (op.toUpperCase(Locale.ROOT)) {
            case "EQ" -> actualText != null && actualText.equalsIgnoreCase(expected);
            case "NEQ" -> actualText == null || !actualText.equalsIgnoreCase(expected);
            case "EMPTY" -> actualText == null || actualText.isBlank();
            case "NOT_EMPTY" -> actualText != null && !actualText.isBlank();
            default -> false;
        };
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || value.asText().isBlank()) {
            return null;
        }
        return value.asText().trim();
    }
}
