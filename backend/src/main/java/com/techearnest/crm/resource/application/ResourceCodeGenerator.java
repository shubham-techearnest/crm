package com.techearnest.crm.resource.application;

import com.techearnest.crm.resource.domain.Resource;
import com.techearnest.crm.resource.domain.ResourceRepository;
import java.util.Locale;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hands out per-organization resource codes: {@code EMP-001} for employees, {@code CON-001} for contractors and
 * consultants, {@code FRL-001} for freelancers. Numbers come from {@code resource_code_sequences} via an atomic upsert,
 * so concurrent creates never receive the same code; numbers already taken by a manually entered code are skipped.
 */
@Component
public class ResourceCodeGenerator {

    private static final String NEXT_VALUE_SQL =
            """
            INSERT INTO resource_code_sequences (organization_id, prefix, last_value)
            VALUES (?, ?, (
                SELECT COALESCE(MAX(substring(employee_code FROM '^' || ? || '-([0-9]{1,9})$')::bigint), 0) + 1
                FROM resources
                WHERE organization_id = ? AND employee_code ~ ('^' || ? || '-[0-9]{1,9}$')))
            ON CONFLICT (organization_id, prefix)
            DO UPDATE SET last_value = resource_code_sequences.last_value + 1
            RETURNING last_value
            """;

    private final JdbcTemplate jdbcTemplate;
    private final ResourceRepository resourceRepository;
    private final ResourceTypeCatalog typeCatalog;

    public ResourceCodeGenerator(
            JdbcTemplate jdbcTemplate, ResourceRepository resourceRepository, ResourceTypeCatalog typeCatalog) {
        this.jdbcTemplate = jdbcTemplate;
        this.resourceRepository = resourceRepository;
        this.typeCatalog = typeCatalog;
    }

    /** Built-in fallback when the type is not in the catalogue. */
    public static String prefixFor(String resourceType) {
        String type = resourceType == null ? Resource.TYPE_EMPLOYEE : resourceType.trim().toUpperCase(Locale.ROOT);
        return switch (type) {
            case Resource.TYPE_EMPLOYEE -> "EMP";
            case Resource.TYPE_FREELANCER -> "FRL";
            default -> "CON";
        };
    }

    public static String format(String prefix, long number) {
        return String.format(Locale.ROOT, "%s-%03d", prefix, number);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String next(UUID organizationId, String resourceType) {
        String prefix = typeCatalog.find(resourceType)
                .map(com.techearnest.crm.resource.domain.ResourceType::getCodePrefix)
                .orElseGet(() -> prefixFor(resourceType));
        while (true) {
            Long value = jdbcTemplate.queryForObject(
                    NEXT_VALUE_SQL, Long.class, organizationId, prefix, prefix, organizationId, prefix);
            String code = format(prefix, value);
            if (!resourceRepository.existsByOrganizationIdAndEmployeeCodeAndDeletedAtIsNull(organizationId, code)) {
                return code;
            }
        }
    }
}
