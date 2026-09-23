package com.techearnest.crm.account.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Account fields accepted by list/query filters. */
public final class AccountFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("accountType", FieldMeta.of("accountType", String.class)),
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("industry", FieldMeta.of("industry", String.class)),
            Map.entry("regionId", FieldMeta.of("regionId", UUID.class)),
            Map.entry("ownerId", FieldMeta.of("ownerId", UUID.class)));

    private AccountFilterFields() {}
}
