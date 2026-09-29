package com.techearnest.crm.importer.api.dto;

import com.techearnest.crm.importer.application.ImportFieldSpec;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class BulkImportDtos {

    private BulkImportDtos() {}

    /**
     * One map per spreadsheet row, keyed by the module's import field keys (e.g. "accountName", "email").
     * Related records are referenced by name/code/email; the server resolves them to IDs.
     */
    public record BulkImportRequest(
            List<Map<String, String>> rows, UUID defaultRegionId, Boolean skipDuplicates, UUID organizationId) {}

    /** index is 0-based into the submitted rows. */
    public record ImportIssue(int index, String outcome, String reason) {}

    /**
     * For a dry run, {@code imported} counts rows that would be created; nothing is saved.
     */
    public record BulkImportResult(
            String module,
            int total,
            int imported,
            int skipped,
            int failed,
            List<ImportIssue> issues,
            boolean dryRun) {}

    /**
     * Target fields of an importable module. {@code customFieldsSupported} is false while business records have
     * no storage for custom field values, so the client must not offer to import into new custom fields.
     */
    public record ImportSchema(
            String module,
            String metadataTable,
            boolean usesRegion,
            String groupKey,
            String duplicateRule,
            int maxRows,
            boolean customFieldsSupported,
            List<ImportFieldSpec> fields) {}
}
