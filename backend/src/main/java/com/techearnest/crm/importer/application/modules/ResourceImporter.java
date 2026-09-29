package com.techearnest.crm.importer.application.modules;

import com.techearnest.crm.importer.application.BulkImportService;
import com.techearnest.crm.importer.application.ImportFieldSpec;
import com.techearnest.crm.importer.application.ImportRow;
import com.techearnest.crm.importer.application.ModuleImporter;
import com.techearnest.crm.importer.application.RowRejected;
import com.techearnest.crm.resource.api.dto.ResourceDtos.CreateResourceRequest;
import com.techearnest.crm.resource.application.ResourceService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

@Component
public class ResourceImporter implements ModuleImporter {

    private static final Set<String> TYPES = Set.of("EMPLOYEE", "CONTRACTOR", "FREELANCER", "CONSULTANT");
    private static final Set<String> STATUSES = Set.of("AVAILABLE", "ON_LEAVE", "INACTIVE");

    private final ResourceService resourceService;
    private final BulkImportService bulkImportService;

    public ResourceImporter(ResourceService resourceService, @Lazy BulkImportService bulkImportService) {
        this.resourceService = resourceService;
        this.bulkImportService = bulkImportService;
    }

    @Override
    public String module() {
        return "resources";
    }

    @Override
    public String metadataTable() {
        return "resource";
    }

    @Override
    public String importPermission() {
        return "RESOURCE_IMPORT";
    }

    @Override
    public List<ImportFieldSpec> fields() {
        return List.of(
                ImportFieldSpec.text("employeeCode", "Employee code", 64)
                        .aliases("emp code", "employee id", "emp id", "employee number", "staff id"),
                ImportFieldSpec.reference("userEmail", "User", "User's login email", "userId")
                        .aliases("user email", "email", "login email"),
                ImportFieldSpec.text("designation", "Designation", 128).aliases("title", "job title", "role"),
                ImportFieldSpec.enumeration("resourceType", "Resource type", TYPES.stream().sorted().toList(), "EMPLOYEE")
                        .aliases("type", "employment type"),
                ImportFieldSpec.of("joiningDate", "Joining date", "DATE").aliases("doj", "date of joining", "start date"),
                ImportFieldSpec.of("costRate", "Cost rate", "DECIMAL").aliases("cost", "hourly cost"),
                ImportFieldSpec.of("billingRate", "Billing rate", "DECIMAL").aliases("bill rate", "hourly rate"),
                ImportFieldSpec.of("capacityHoursPerWeek", "Capacity hours per week", "DECIMAL")
                        .aliases("capacity", "hours per week", "weekly hours"),
                ImportFieldSpec.enumeration("status", "Status", STATUSES.stream().sorted().toList(), null)
                        .aliases("availability"),
                ImportFieldSpec.region(),
                ImportFieldSpec.reference("managerEmail", "Manager", "Manager's user email", "managerId")
                        .aliases("manager email", "reporting manager"));
    }

    @Override
    public boolean usesRegion() {
        return true;
    }

    @Override
    public String duplicateRule() {
        return "Skip rows whose employee code already exists (otherwise they are reported as failed)";
    }

    @Override
    public String createPermission() {
        return "RESOURCE_MANAGE";
    }

    @Override
    public String importGroup(Context context, List<ImportRow> rows) {
        ImportRow row = rows.get(0);
        String employeeCode = row.text("employeeCode");
        UUID userId = context.lookups().userByEmail(row.email("userEmail", "User email"));
        if (employeeCode == null && userId == null) {
            throw new RowRejected("Row needs an employee code or a user email");
        }
        if (employeeCode != null) {
            String key = employeeCode.toLowerCase(Locale.ROOT);
            if (!context.firstInFile("employee-code", key)) {
                return "Same employee code appears earlier in the file";
            }
            if (context.lookups().exists(
                    "select count(r) from Resource r where r.organizationId = :org and r.deletedAt is null"
                            + " and lower(r.employeeCode) = :code", "code", key)) {
                if (context.skipDuplicates()) {
                    return "A resource with this employee code already exists";
                }
                throw new RowRejected("Employee code '" + employeeCode + "' already exists");
            }
        }
        BigDecimal capacity = row.decimal("capacityHoursPerWeek", "Capacity hours per week");
        if (capacity != null && capacity.signum() == 0) {
            throw new RowRejected("Capacity hours per week must be greater than 0");
        }
        resourceService.create(bulkImportService.validated(new CreateResourceRequest(
                context.lookups().organizationId(),
                context.regionOrDefault(row, "region"),
                userId,
                employeeCode,
                row.text("designation"),
                null,
                context.lookups().userByEmail(row.email("managerEmail", "Manager email")),
                row.code("resourceType", "Resource type", TYPES, "EMPLOYEE"),
                row.date("joiningDate", "Joining date"),
                row.decimal("costRate", "Cost rate"),
                row.decimal("billingRate", "Billing rate"),
                capacity,
                row.code("status", "Status", STATUSES, null))));
        return null;
    }
}
