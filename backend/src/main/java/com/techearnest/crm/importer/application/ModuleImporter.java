package com.techearnest.crm.importer.application;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Imports one module's spreadsheet rows by delegating to the module's own create service, so permission,
 * visibility and business rules are identical to creating the record by hand.
 */
public interface ModuleImporter {

    /** URL segment, e.g. "contacts" for POST /api/v1/imports/contacts. */
    String module();

    /** {@code sys_table.code} of the target entity, used to pick up tenant field labels from Studio. */
    String metadataTable();

    String importPermission();

    String createPermission();

    /** Target fields this importer reads, in display order. */
    List<ImportFieldSpec> fields();

    /** Records need a region; the client offers a default region and a Region column may override it. */
    default boolean usesRegion() {
        return false;
    }

    /** Row key whose equal values form one multi-row record, or null for one row per record. */
    default String groupKey() {
        return null;
    }

    /** Describes the duplicate check applied when "skip duplicates" is on, or null when there is none. */
    default String duplicateRule() {
        return null;
    }

    /**
     * Groups row indexes that form one record (e.g. several line items of one invoice). Default: one row per
     * record, or rows sharing {@link #groupKey()} when set.
     */
    default List<List<Integer>> group(List<ImportRow> rows) {
        if (groupKey() != null) {
            return groupByKey(rows, groupKey());
        }
        List<List<Integer>> groups = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            groups.add(List.of(i));
        }
        return groups;
    }

    /**
     * Creates the record for one group, running inside its own transaction. Throw {@link RowRejected} for
     * invalid data; return a non-null reason to skip the group as a duplicate.
     */
    String importGroup(Context context, List<ImportRow> rows);

    record Context(ImportLookups lookups, UUID defaultRegionId, boolean skipDuplicates, Map<String, Object> state) {

        public UUID regionOrDefault(ImportRow row, String key) {
            UUID region = lookups.region(row.text(key));
            if (region != null) {
                return region;
            }
            if (defaultRegionId == null) {
                throw new RowRejected("Region is required (add a Region column or choose a default region)");
            }
            return defaultRegionId;
        }

        /** Remembers a key for the whole import; returns false if it was already seen earlier in the file. */
        @SuppressWarnings("unchecked")
        public boolean firstInFile(String scope, String key) {
            Map<String, Boolean> seen = (Map<String, Boolean>) state.computeIfAbsent(scope, s -> new LinkedHashMap<>());
            return seen.putIfAbsent(key, Boolean.TRUE) == null;
        }
    }

    static List<List<Integer>> groupByKey(List<ImportRow> rows, String key) {
        Map<String, List<Integer>> byKey = new LinkedHashMap<>();
        List<List<Integer>> groups = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            String value = rows.get(i).text(key);
            if (value == null) {
                groups.add(List.of(i));
                continue;
            }
            List<Integer> existing = byKey.get(value.toLowerCase(java.util.Locale.ROOT));
            if (existing == null) {
                existing = new ArrayList<>();
                byKey.put(value.toLowerCase(java.util.Locale.ROOT), existing);
                groups.add(existing);
            }
            existing.add(i);
        }
        return groups;
    }
}
