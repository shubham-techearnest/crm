package com.techearnest.crm.resource.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.util.Map;

/** Whitelist of Skill fields accepted by list filters. */
public final class SkillFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("name", FieldMeta.of("name", String.class)),
            Map.entry("category", FieldMeta.of("category", String.class)));

    private SkillFilterFields() {}
}
