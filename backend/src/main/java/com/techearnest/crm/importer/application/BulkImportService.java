package com.techearnest.crm.importer.application;

import com.techearnest.crm.common.exception.ApiException;
import com.techearnest.crm.common.exception.BusinessException;
import com.techearnest.crm.common.exception.ResourceNotFoundException;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.importer.api.dto.BulkImportDtos.BulkImportRequest;
import com.techearnest.crm.importer.api.dto.BulkImportDtos.BulkImportResult;
import com.techearnest.crm.importer.api.dto.BulkImportDtos.ImportIssue;
import com.techearnest.crm.importer.api.dto.BulkImportDtos.ImportSchema;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Runs a module importer over spreadsheet rows. Each record is saved in its own transaction so valid rows are
 * kept and invalid rows are reported with a reason instead of rolling back the whole file.
 */
@Service
public class BulkImportService {

    public static final int MAX_ROWS = 2000;
    static final String OUTCOME_FAILED = "FAILED";
    static final String OUTCOME_SKIPPED = "SKIPPED";

    private static final Logger log = LoggerFactory.getLogger(BulkImportService.class);

    private final Map<String, ModuleImporter> importers;
    private final TenantAccess tenantAccess;
    private final EntityManager entityManager;
    private final Validator validator;
    private final TransactionTemplate recordTransaction;

    public BulkImportService(
            List<ModuleImporter> importers,
            TenantAccess tenantAccess,
            EntityManager entityManager,
            Validator validator,
            PlatformTransactionManager transactionManager) {
        this.importers = importers.stream().collect(Collectors.toMap(ModuleImporter::module, Function.identity()));
        this.tenantAccess = tenantAccess;
        this.entityManager = entityManager;
        this.validator = validator;
        this.recordTransaction = new TransactionTemplate(transactionManager);
        this.recordTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Target fields for the mapping screen. Labels the tenant has given the same fields in Studio are added as
     * aliases so headers exported from this CRM (or renamed by an admin) are recognised.
     */
    public ImportSchema schema(String module, UUID requestedOrganizationId) {
        ModuleImporter importer = requireImporter(module);
        UUID organizationId = tenantAccess.resolveOrganizationId(requestedOrganizationId);
        Map<String, List<String>> studioLabels = studioLabels(importer.metadataTable(), organizationId);
        List<ImportFieldSpec> fields = importer.fields().stream()
                .map(field -> withStudioLabels(field, studioLabels.getOrDefault(field.metadataCode(), List.of())))
                .toList();
        return new ImportSchema(
                importer.module(),
                importer.metadataTable(),
                importer.usesRegion(),
                importer.groupKey(),
                importer.duplicateRule(),
                MAX_ROWS,
                false,
                fields);
    }

    public BulkImportResult importRows(String module, BulkImportRequest request) {
        return run(module, request, false);
    }

    /**
     * Runs the full import (lookups, duplicate checks, module business rules, database constraints) and rolls
     * every record back, so the preview reports exactly which rows would fail.
     */
    public BulkImportResult validateRows(String module, BulkImportRequest request) {
        return run(module, request, true);
    }

    private BulkImportResult run(String module, BulkImportRequest request, boolean dryRun) {
        ModuleImporter importer = requireImporter(module);
        UUID organizationId = tenantAccess.resolveOrganizationId(request == null ? null : request.organizationId());

        List<Map<String, String>> raw = request == null || request.rows() == null ? List.of() : request.rows();
        if (raw.isEmpty()) {
            throw new BusinessException("IMPORT_EMPTY", "The file has no rows to import");
        }
        if (raw.size() > MAX_ROWS) {
            throw new BusinessException(
                    "IMPORT_LIMIT", "A single import is limited to " + MAX_ROWS + " rows; split the file");
        }
        List<ImportRow> rows = raw.stream().map(ImportRow::new).toList();
        ModuleImporter.Context context = new ModuleImporter.Context(
                new ImportLookups(entityManager, organizationId),
                request.defaultRegionId(),
                request.skipDuplicates() == null || request.skipDuplicates(),
                new HashMap<>());

        List<ImportIssue> issues = new ArrayList<>();
        int imported = 0;
        for (List<Integer> group : importer.group(rows)) {
            List<ImportRow> groupRows = group.stream().map(rows::get).toList();
            if (groupRows.stream().allMatch(ImportRow::isEmpty)) {
                group.forEach(i -> issues.add(new ImportIssue(i, OUTCOME_SKIPPED, "Row is empty")));
                continue;
            }
            try {
                String skipReason = recordTransaction.execute(status -> {
                    String reason = importer.importGroup(context, groupRows);
                    if (dryRun) {
                        entityManager.flush();
                        status.setRollbackOnly();
                    }
                    return reason;
                });
                if (skipReason != null) {
                    group.forEach(i -> issues.add(new ImportIssue(i, OUTCOME_SKIPPED, skipReason)));
                } else {
                    imported += group.size();
                }
            } catch (RowRejected e) {
                fail(issues, group, e.getMessage());
            } catch (ApiException e) {
                fail(issues, group, describe(e));
            } catch (DataAccessException e) {
                log.warn("{} import rows {} rejected by database: {}", module, group,
                        e.getMostSpecificCause().getMessage());
                fail(issues, group, "Rejected by the database (invalid or duplicate value)");
            } catch (PersistenceException e) {
                log.warn("{} import rows {} rejected by database: {}", module, group, e.getMessage());
                fail(issues, group, "Rejected by the database (invalid or duplicate value)");
            }
        }
        issues.sort(Comparator.comparingInt(ImportIssue::index));
        int skipped = (int) issues.stream().filter(i -> OUTCOME_SKIPPED.equals(i.outcome())).count();
        int failed = issues.size() - skipped;
        return new BulkImportResult(module, rows.size(), imported, skipped, failed, issues, dryRun);
    }

    private ModuleImporter requireImporter(String module) {
        ModuleImporter importer = importers.get(module);
        if (importer == null) {
            throw new ResourceNotFoundException("Import is not available for '" + module + "'");
        }
        tenantAccess.requirePermission(importer.importPermission());
        tenantAccess.requirePermission(importer.createPermission());
        return importer;
    }

    private Map<String, List<String>> studioLabels(String tableCode, UUID organizationId) {
        List<Object[]> rows = entityManager.createQuery(
                        "select f.code, f.label from SysField f, SysTable t where f.tableId = t.id"
                                + " and t.code = :table and f.active = true"
                                + " and (f.organizationId is null or f.organizationId = :org)"
                                + " and (t.organizationId is null or t.organizationId = :org)",
                        Object[].class)
                .setParameter("table", tableCode)
                .setParameter("org", organizationId)
                .getResultList();
        Map<String, List<String>> labels = new HashMap<>();
        for (Object[] row : rows) {
            labels.computeIfAbsent((String) row[0], k -> new ArrayList<>()).add((String) row[1]);
        }
        return labels;
    }

    private static ImportFieldSpec withStudioLabels(ImportFieldSpec field, List<String> labels) {
        String[] extra = labels.stream()
                .filter(label -> label != null && !label.isBlank())
                .filter(label -> !label.equalsIgnoreCase(field.label()))
                .filter(label -> field.aliases().stream().noneMatch(label::equalsIgnoreCase))
                .distinct()
                .toArray(String[]::new);
        return extra.length == 0 ? field : field.aliases(extra);
    }

    /** Bean-validates a create request built from a row, reporting the first violation as a row error. */
    public <T> T validated(T request) {
        Set<ConstraintViolation<T>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            ConstraintViolation<T> first = violations.stream()
                    .min(Comparator.comparing(v -> v.getPropertyPath().toString()))
                    .orElseThrow();
            throw new RowRejected(first.getPropertyPath() + ": " + first.getMessage());
        }
        return request;
    }

    private static void fail(List<ImportIssue> issues, List<Integer> group, String reason) {
        group.forEach(i -> issues.add(new ImportIssue(i, OUTCOME_FAILED, reason)));
    }

    private static String describe(ApiException e) {
        if (e.getMessage() == null || "Resource not found".equals(e.getMessage())) {
            return "A referenced record (region, account, vendor or project) was not found or is not accessible";
        }
        return e.getMessage();
    }
}
