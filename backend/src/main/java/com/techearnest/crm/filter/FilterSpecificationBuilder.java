package com.techearnest.crm.filter;

import com.techearnest.crm.common.exception.BusinessException;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

public final class FilterSpecificationBuilder {

    private FilterSpecificationBuilder() {}

    public static <T> Specification<T> build(FilterNode root, Map<String, FieldMeta> allowedFields) {
        if (root == null) {
            return (r, q, cb) -> cb.conjunction();
        }
        return (rootEntity, query, cb) -> toPredicate(root, rootEntity, cb, allowedFields);
    }

    private static <T> Predicate toPredicate(
            FilterNode node, Root<T> root, CriteriaBuilder cb, Map<String, FieldMeta> allowedFields) {
        if (node.isGroup()) {
            List<Predicate> predicates = new ArrayList<>();
            for (FilterNode child : node.conditions()) {
                predicates.add(toPredicate(child, root, cb, allowedFields));
            }
            if (predicates.isEmpty()) {
                return cb.conjunction();
            }
            return "OR".equals(node.groupOp())
                    ? cb.or(predicates.toArray(Predicate[]::new))
                    : cb.and(predicates.toArray(Predicate[]::new));
        }
        return leafPredicate(node, root, cb, allowedFields);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static <T> Predicate leafPredicate(
            FilterNode node, Root<T> root, CriteriaBuilder cb, Map<String, FieldMeta> allowedFields) {
        if (node.field() == null || node.field().isBlank()) {
            throw new BusinessException("FILTER_FIELD_REQUIRED", "Filter field is required");
        }
        String fieldKey = node.field().trim();
        FieldMeta meta = allowedFields.get(fieldKey);
        if (meta == null) {
            // also try camelCase lookup from common aliases
            meta = allowedFields.get(fieldKey.toLowerCase(Locale.ROOT));
        }
        if (meta == null) {
            throw new BusinessException("FILTER_FIELD_DENIED", "Field not filterable: " + fieldKey);
        }
        FilterOperator op = FilterOperator.from(node.operator());
        Path path = root.get(meta.jpaAttribute());

        return switch (op) {
            case EQ -> cb.equal(path, coerce(node.value(), meta.type()));
            case NE -> cb.notEqual(path, coerce(node.value(), meta.type()));
            case CONTAINS -> cb.like(cb.lower(path.as(String.class)), "%" + stringValue(node.value()).toLowerCase(Locale.ROOT) + "%");
            case NOT_CONTAINS -> cb.notLike(
                    cb.lower(path.as(String.class)), "%" + stringValue(node.value()).toLowerCase(Locale.ROOT) + "%");
            case STARTS_WITH -> cb.like(
                    cb.lower(path.as(String.class)), stringValue(node.value()).toLowerCase(Locale.ROOT) + "%");
            case ENDS_WITH -> cb.like(
                    cb.lower(path.as(String.class)), "%" + stringValue(node.value()).toLowerCase(Locale.ROOT));
            case GT -> cb.greaterThan(path, (Comparable) coerce(node.value(), meta.type()));
            case GTE -> cb.greaterThanOrEqualTo(path, (Comparable) coerce(node.value(), meta.type()));
            case LT -> cb.lessThan(path, (Comparable) coerce(node.value(), meta.type()));
            case LTE -> cb.lessThanOrEqualTo(path, (Comparable) coerce(node.value(), meta.type()));
            case IN -> path.in(coerceCollection(node.value(), meta.type()));
            case NOT_IN -> cb.not(path.in(coerceCollection(node.value(), meta.type())));
            case IS_EMPTY -> cb.isNull(path);
            case IS_NOT_EMPTY -> cb.isNotNull(path);
            case BETWEEN -> cb.between(
                    path,
                    (Comparable) coerce(node.value(), meta.type()),
                    (Comparable) coerce(node.valueTo() != null ? node.valueTo() : node.value(), meta.type()));
        };
    }

    private static Object coerce(Object raw, Class<?> type) {
        if (raw == null) {
            return null;
        }
        if (type.isInstance(raw)) {
            return raw;
        }
        String text = String.valueOf(raw).trim();
        if (type == String.class) {
            return text;
        }
        if (type == UUID.class) {
            return UUID.fromString(text);
        }
        if (type == Integer.class || type == int.class) {
            return Integer.valueOf(text);
        }
        if (type == Long.class || type == long.class) {
            return Long.valueOf(text);
        }
        if (type == BigDecimal.class) {
            return new BigDecimal(text);
        }
        if (type == LocalDate.class) {
            return LocalDate.parse(text);
        }
        if (type == Instant.class) {
            return Instant.parse(text);
        }
        if (type == Boolean.class || type == boolean.class) {
            return Boolean.valueOf(text);
        }
        throw new BusinessException("FILTER_VALUE_TYPE", "Cannot coerce value for type " + type.getSimpleName());
    }

    private static Collection<?> coerceCollection(Object raw, Class<?> type) {
        if (raw instanceof Collection<?> collection) {
            return collection.stream().map(v -> coerce(v, type)).toList();
        }
        if (raw instanceof String s && s.contains(",")) {
            return java.util.Arrays.stream(s.split(","))
                    .map(String::trim)
                    .filter(part -> !part.isEmpty())
                    .map(part -> coerce(part, type))
                    .toList();
        }
        return List.of(coerce(raw, type));
    }

    private static String stringValue(Object raw) {
        return raw == null ? "" : String.valueOf(raw);
    }

    public record FieldMeta(String jpaAttribute, Class<?> type) {
        public static FieldMeta of(String jpaAttribute, Class<?> type) {
            return new FieldMeta(jpaAttribute, type);
        }
    }
}
