package com.techearnest.crm.contact.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Contact fields accepted by list/query filters. */
public final class ContactFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("accountId", FieldMeta.of("accountId", UUID.class)),
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("ownerId", FieldMeta.of("ownerId", UUID.class)),
            Map.entry("email", FieldMeta.of("email", String.class)),
            Map.entry("designation", FieldMeta.of("designation", String.class)));

    private ContactFilterFields() {}
}
