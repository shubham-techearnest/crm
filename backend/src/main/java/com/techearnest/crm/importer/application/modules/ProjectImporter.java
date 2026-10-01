package com.techearnest.crm.importer.application.modules;

import com.techearnest.crm.importer.application.BulkImportService;
import com.techearnest.crm.importer.application.ImportFieldSpec;
import com.techearnest.crm.importer.application.ImportRow;
import com.techearnest.crm.importer.application.ModuleImporter;
import com.techearnest.crm.importer.application.RowRejected;
import com.techearnest.crm.project.api.dto.ProjectDtos.CreateProjectRequest;
import com.techearnest.crm.project.application.ProjectService;
import com.techearnest.crm.project.domain.Project;
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
    private static final Set<String> BILLING = Set.copyOf(Project.BILLING_TYPES);
    /** Older import files may still use the pre-V39 names; the service maps them. */
    private static final Set<String> ACCEPTED_BILLING = Set.of(
            "STAFF_AUGMENTATION", "TIME_AND_MATERIAL", "FIXED_MONTHLY", "FIXED_BID", "NON_BILLABLE",
            "FIXED_PRICE", "HOURLY", "MILESTONE", "RETAINER");
    private static final Set<String> PROJECT_TYPES = Set.copyOf(Project.PROJECT_TYPES);

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
                ImportFieldSpec.text("projectCode", "Project code (blank = auto-generated)", 64)
                        .aliases("code", "project id", "project no"),
                ImportFieldSpec.enumeration("projectType", "Project type", PROJECT_TYPES.stream().sorted().toList(),
                                Project.TYPE_B2B)
                        .aliases("type", "project category"),
                ImportFieldSpec.reference("accountName", "Account", "Account name (not needed for IN_HOUSE)", "accountId")
                        .aliases("client", "customer", "company", "company name"),
                ImportFieldSpec.enumeration("billingType", "Billing type", BILLING.stream().sorted().toList(),
                                Project.BILLING_FIXED_BID)
                        .aliases("billing", "billing model"),
                ImportFieldSpec.of("hourlyRate", "Hourly rate", "DECIMAL").aliases("rate", "bill rate"),
                ImportFieldSpec.of("monthlyFee", "Monthly fee", "DECIMAL").aliases("monthly amount", "retainer"),
                ImportFieldSpec.of("contractValue", "Contract value", "DECIMAL").aliases("fixed bid", "contract amount"),
                ImportFieldSpec.text("contractReference", "Contract reference", 128)
                        .aliases("contract no", "contract number", "po number"),
                ImportFieldSpec.of("contractSignedDate", "Contract signed date", "DATE").aliases("signed date"),
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
        String code = row.text("projectCode");
        if (code != null) {
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
        }
        LocalDate start = row.date("startDate", "Start date");
        LocalDate end = row.date("endDate", "End date");
        if (start != null && end != null && end.isBefore(start)) {
            throw new RowRejected("End date cannot be before start date");
        }
        String projectType = row.code("projectType", "Project type", PROJECT_TYPES, Project.TYPE_B2B);
        boolean inHouse = Project.TYPE_IN_HOUSE.equals(projectType);
        projectService.create(bulkImportService.validated(new CreateProjectRequest(
                context.lookups().organizationId(),
                context.regionOrDefault(row, "region"),
                inHouse ? null : context.lookups().account(row.required("accountName", "Account")),
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
                row.code("billingType", "Billing type", ACCEPTED_BILLING,
                        inHouse ? Project.BILLING_NON_BILLABLE : Project.BILLING_FIXED_BID),
                row.decimal("hourlyRate", "Hourly rate"),
                row.decimal("monthlyFee", "Monthly fee"),
                row.decimal("contractValue", "Contract value"),
                projectType,
                row.text("contractReference"),
                row.date("contractSignedDate", "Contract signed date"))));
        return null;
    }
}
