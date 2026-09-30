package com.techearnest.crm.importer.application.modules;

import com.techearnest.crm.importer.application.BulkImportService;
import com.techearnest.crm.importer.application.ImportFieldSpec;
import com.techearnest.crm.importer.application.ImportRow;
import com.techearnest.crm.importer.application.ModuleImporter;
import com.techearnest.crm.importer.application.RowRejected;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.CreateTimeEntryRequest;
import com.techearnest.crm.timesheet.application.TimesheetService;
import com.techearnest.crm.timesheet.domain.Timesheet;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * Imports hours from a spreadsheet (one row per resource, day and project). Rows of the same resource and week
 * become one timesheet; rows are added to an existing draft for that week when there is one.
 */
@Component
public class TimesheetImporter implements ModuleImporter {

    private final TimesheetService timesheetService;
    private final BulkImportService bulkImportService;

    public TimesheetImporter(TimesheetService timesheetService, @Lazy BulkImportService bulkImportService) {
        this.timesheetService = timesheetService;
        this.bulkImportService = bulkImportService;
    }

    @Override
    public String module() {
        return "timesheets";
    }

    @Override
    public String metadataTable() {
        return "timesheet";
    }

    @Override
    public String importPermission() {
        return "TIMESHEET_IMPORT";
    }

    @Override
    public String createPermission() {
        return "TIMESHEET_PROXY";
    }

    @Override
    public List<ImportFieldSpec> fields() {
        return List.of(
                ImportFieldSpec.reference("resource", "Resource", "Employee code or email", "resourceId")
                        .mandatory()
                        .aliases("employee", "employee code", "emp code", "resource email", "email"),
                ImportFieldSpec.of("workDate", "Work date", "DATE").mandatory().aliases("date", "day", "work day"),
                ImportFieldSpec.reference("project", "Project", "Project code or name", "projectId")
                        .mandatory()
                        .aliases("project code", "project name"),
                ImportFieldSpec.reference("task", "Task", "Task name within the project", "taskId")
                        .aliases("task name", "activity"),
                ImportFieldSpec.of("hours", "Hours", "DECIMAL").mandatory().aliases("hrs", "time", "duration"),
                ImportFieldSpec.of("billable", "Billable", "BOOLEAN").aliases("is billable"),
                ImportFieldSpec.text("description", "Description", 500).aliases("notes", "comment", "work done"),
                ImportFieldSpec.of("submit", "Submit for approval", "BOOLEAN").aliases("submitted", "send for approval"));
    }

    @Override
    public String duplicateRule() {
        return "Weeks that are already submitted or approved are reported as failed";
    }

    @Override
    public List<List<Integer>> group(List<ImportRow> rows) {
        Map<String, List<Integer>> byWeek = new LinkedHashMap<>();
        List<List<Integer>> groups = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            String key = weekKey(rows.get(i));
            if (key == null) {
                groups.add(List.of(i));
                continue;
            }
            List<Integer> existing = byWeek.get(key);
            if (existing == null) {
                existing = new ArrayList<>();
                byWeek.put(key, existing);
                groups.add(existing);
            }
            existing.add(i);
        }
        return groups;
    }

    @Override
    public String importGroup(Context context, List<ImportRow> rows) {
        ImportRow first = rows.get(0);
        UUID resourceId = context.lookups().resource(first.required("resource", "Resource"));
        LocalDate workDate = requiredDate(first);
        LocalDate monday = TimesheetService.mondayOf(workDate);
        UUID timesheetId = timesheetService.findOrCreateEditable(
                context.lookups().organizationId(), resourceId, monday, Timesheet.SOURCE_IMPORT);

        boolean submit = false;
        for (ImportRow row : rows) {
            UUID projectId = context.lookups().project(row.required("project", "Project"));
            BigDecimal hours = row.decimal("hours", "Hours");
            if (hours == null || hours.signum() == 0) {
                throw new RowRejected("Hours must be greater than 0");
            }
            timesheetService.addEntry(timesheetId, bulkImportService.validated(new CreateTimeEntryRequest(
                    projectId,
                    context.lookups().task(projectId, row.text("task")),
                    requiredDate(row),
                    hours,
                    row.text("description"),
                    row.bool("billable", "Billable"),
                    null)));
            submit |= Boolean.TRUE.equals(row.bool("submit", "Submit for approval"));
        }
        if (submit) {
            timesheetService.submit(timesheetId);
        }
        return null;
    }

    private static LocalDate requiredDate(ImportRow row) {
        LocalDate date = row.date("workDate", "Work date");
        if (date == null) {
            throw new RowRejected("Work date is required");
        }
        return date;
    }

    private static String weekKey(ImportRow row) {
        String resource = row.text("resource");
        String date = row.text("workDate");
        if (resource == null || date == null) {
            return null;
        }
        try {
            return resource.toLowerCase(Locale.ROOT) + "|" + TimesheetService.mondayOf(LocalDate.parse(date));
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
