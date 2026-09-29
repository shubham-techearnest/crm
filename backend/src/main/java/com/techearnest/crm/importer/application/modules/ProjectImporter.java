package com.techearnest.crm.importer.application.modules;

import com.techearnest.crm.importer.application.BulkImportService;
import com.techearnest.crm.importer.application.ImportFieldSpec;
import com.techearnest.crm.importer.application.ImportRow;
import com.techearnest.crm.importer.application.ModuleImporter;
import com.techearnest.crm.importer.application.RowRejected;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateProjectRequest;
import com.techearnest.crm.project.application.ProjectService;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

@Component
public class ProjectImporter implements ModuleImporter {

    private static final Set<String> STATUSES = Set.of("PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED");
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH");
    private static final Set<String> BILLING = Set.of("FIXED_PRICE", "HOURLY", "MILESTONE", "RETAINER");

    private final ProjectService projectService;
    private final BulkImportService bulkImportService;

    public ProjectImporter(ProjectService projectService, @Lazy BulkImportService bulkImportService) {
        this.projectService = projectService;
        this.bulkImportService = bulkImportService;
    }

    @Override
    public String module() {
        return "projects";
    }

    @Override
    public String metadataTable() {
        return "project";
    }

    @Override
    public String importPermission() {
        return "PROJECT_IMPORT";
    }

    @Override
    public List<ImportFieldSpec> fields() {
        return List.of(
                ImportFieldSpec.text("name", "Project name", 255).mandatory().aliases("project", "project title"),
                ImportFieldSpec.text("projectCode", "Project code", 64).mandatory().aliases("code", "project id", "project no"),
                ImportFieldSpec.reference("accountName", "Account", "Account name", "accountId").mandatory()
                        .aliases("client", "customer", "company", "company name"),
                ImportFieldSpec.enumeration("billingType", "Billing type", BILLING.stream().sorted().toList(), "FIXED_PRICE")
                        .aliases("billing", "billing model"),
                ImportFieldSpec.enumeration("status", "Status", STATUSES.stream().sorted().toList(), "ACTIVE")
                        .aliases("project status"),
                ImportFieldSpec.enumeration("priority", "Priority", PRIORITIES.stream().sorted().toList(), null),
                ImportFieldSpec.of("startDate", "Start date", "DATE").aliases("start", "kickoff date"),
                ImportFieldSpec.of("endDate", "End date", "DATE").aliases("end", "finish date", "due date"),
                ImportFieldSpec.of("budget", "Budget", "DECIMAL").aliases("project budget", "amount"),
                ImportFieldSpec.of("estimatedHours", "Estimated hours", "DECIMAL").aliases("hours", "effort"),
                ImportFieldSpec.region(),
                ImportFieldSpec.reference("projectManagerEmail", "Project manager", "Project manager's user email",
                        "projectManagerId").aliases("project manager email", "pm", "manager"),
                ImportFieldSpec.of("description", "Description", "TEXT").aliases("notes", "summary"));
    }

    @Override
    public boolean usesRegion() {
        return true;
    }

    @Override
    public String duplicateRule() {
        return "Skip rows whose project code already exists (otherwise they are reported as failed)";
    }

    @Override
    public String createPermission() {
        return "PROJECT_CREATE";
    }

    @Override
    public String importGroup(Context context, List<ImportRow> rows) {
        ImportRow row = rows.get(0);
        String code = row.required("projectCode", "Project code");
        String key = code.toLowerCase(Locale.ROOT);
        if (!context.firstInFile("project-code", key)) {
            return "Same project code appears earlier in the file";
        }
        if (context.lookups().exists(
                "select count(p) from Project p where p.organizationId = :org and lower(p.projectCode) = :code",
                "code", key)) {
            if (context.skipDuplicates()) {
                return "A project with this code already exists";
            }
            throw new RowRejected("Project code '" + code + "' already exists");
        }
        LocalDate start = row.date("startDate", "Start date");
        LocalDate end = row.date("endDate", "End date");
        if (start != null && end != null && end.isBefore(start)) {
            throw new RowRejected("End date cannot be before start date");
        }
        projectService.create(bulkImportService.validated(new CreateProjectRequest(
                context.lookups().organizationId(),
                context.regionOrDefault(row, "region"),
                context.lookups().account(row.required("accountName", "Account")),
                null,
                context.lookups().userByEmail(row.text("projectManagerEmail")),
                row.required("name", "Project name"),
                code,
                row.text("description"),
                row.code("status", "Status", STATUSES, "ACTIVE"),
                row.code("priority", "Priority", PRIORITIES, null),
                start,
                end,
                row.decimal("budget", "Budget"),
                row.decimal("estimatedHours", "Estimated hours"),
                row.code("billingType", "Billing type", BILLING, "FIXED_PRICE"))));
        return null;
    }
}
