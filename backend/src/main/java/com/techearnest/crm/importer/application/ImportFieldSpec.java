package com.techearnest.crm.importer.application;

import java.util.ArrayList;
import java.util.List;

/**
 * One importable target field of a module, as understood by that module's importer.
 *
 * @param key row key the importer reads (sent by the client as the mapping target)
 * @param type one of TEXT, EMAIL, PHONE, URL, INTEGER, DECIMAL, DATE, BOOLEAN, ENUM, REFERENCE
 * @param options allowed codes for ENUM fields
 * @param reference what a REFERENCE value is looked up by, e.g. "Account name"
 * @param metadataCode matching {@code sys_field.code}, so tenant labels from Studio are recognised as well
 * @param groupHeader read only from the first row of a multi-row record (invoice / purchase order header)
 */
public record ImportFieldSpec(
        String key,
        String label,
        String type,
        boolean required,
        List<String> options,
        Integer maxLength,
        List<String> aliases,
        String reference,
        String metadataCode,
        boolean groupHeader,
        String defaultValue) {

    public static ImportFieldSpec of(String key, String label, String type) {
        return new ImportFieldSpec(key, label, type, false, List.of(), null, List.of(), null, key, false, null);
    }

    public static ImportFieldSpec text(String key, String label, int maxLength) {
        return of(key, label, "TEXT").max(maxLength);
    }

    public static ImportFieldSpec reference(String key, String label, String lookedUpBy, String metadataCode) {
        return new ImportFieldSpec(
                key, label, "REFERENCE", false, List.of(), null, List.of(), lookedUpBy, metadataCode, false, null);
    }

    /** Optional per-row region; falls back to the default region chosen for the import. */
    public static ImportFieldSpec region() {
        return reference("region", "Region", "Region name or code", "regionId").aliases("region name", "region code");
    }

    public static ImportFieldSpec enumeration(String key, String label, List<String> options, String defaultValue) {
        return new ImportFieldSpec(
                key, label, "ENUM", false, List.copyOf(options), null, List.of(), null, key, false, defaultValue);
    }

    public ImportFieldSpec mandatory() {
        return new ImportFieldSpec(key, label, type, true, options, maxLength, aliases, reference, metadataCode,
                groupHeader, defaultValue);
    }

    public ImportFieldSpec max(int length) {
        return new ImportFieldSpec(key, label, type, required, options, length, aliases, reference, metadataCode,
                groupHeader, defaultValue);
    }

    public ImportFieldSpec aliases(String... values) {
        List<String> merged = new ArrayList<>(aliases);
        merged.addAll(List.of(values));
        return new ImportFieldSpec(key, label, type, required, options, maxLength, List.copyOf(merged), reference,
                metadataCode, groupHeader, defaultValue);
    }

    public ImportFieldSpec metadata(String code) {
        return new ImportFieldSpec(key, label, type, required, options, maxLength, aliases, reference, code,
                groupHeader, defaultValue);
    }

    public ImportFieldSpec header() {
        return new ImportFieldSpec(key, label, type, required, options, maxLength, aliases, reference, metadataCode,
                true, defaultValue);
    }
}
