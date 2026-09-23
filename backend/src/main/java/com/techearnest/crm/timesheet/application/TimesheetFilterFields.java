package com.techearnest.crm.timesheet.application;

import com.techearnest.crm.filter.FilterSpecificationBuilder.FieldMeta;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** Whitelist of Timesheet fields accepted by list filters. */
public final class TimesheetFilterFields {

    public static final Map<String, FieldMeta> ALLOWED = Map.ofEntries(
            Map.entry("status", FieldMeta.of("status", String.class)),
            Map.entry("weekStartDate", FieldMeta.of("weekStartDate", LocalDate.class)),
            Map.entry("resourceId", FieldMeta.of("resourceId", UUID.class)),
            Map.entry("billable", FieldMeta.of("billable", Boolean.class)));

    private TimesheetFilterFields() {}
}
