package com.techearnest.crm.lead.application;

import com.techearnest.crm.common.security.CurrentUser;
import com.techearnest.crm.common.security.TenantAccess;
import com.techearnest.crm.importer.application.ImportFieldSpec;
import com.techearnest.crm.importer.application.ImportRow;
import com.techearnest.crm.importer.application.ModuleImporter;
import com.techearnest.crm.lead.api.dto.LeadDtos.CreateLeadRequest;
import com.techearnest.crm.lead.domain.LeadRepository;
import com.techearnest.crm.metadata.application.TableAclEvaluator;
import com.techearnest.crm.metadata.application.TableAclEvaluator.CrudOp;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

/** Lead adapter for the generic bulk import; reuses {@link LeadImportService}'s row normalisation. */
@Component
public class LeadImporter implements ModuleImporter {

    private static final List<String> STATUSES = List.of("NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "LOST");
    private static final List<String> PRIORITIES = List.of("LOW", "MEDIUM", "HIGH");

    private final LeadService leadService;
    private final LeadImportService leadImportService;
    private final LeadRepository leadRepository;
    private final TenantAccess tenantAccess;
    private final TableAclEvaluator tableAclEvaluator;

    public LeadImporter(
            LeadService leadService,
            LeadImportService leadImportService,
            LeadRepository leadRepository,
            TenantAccess tenantAccess,
            TableAclEvaluator tableAclEvaluator) {
        this.leadService = leadService;
        this.leadImportService = leadImportService;
        this.leadRepository = leadRepository;
        this.tenantAccess = tenantAccess;
        this.tableAclEvaluator = tableAclEvaluator;
    }

    @Override
    public String module() {
        return "leads";
    }

    @Override
    public String metadataTable() {
        return "lead";
    }

    @Override
    public String importPermission() {
        return "LEAD_IMPORT";
    }

    @Override
    public String createPermission() {
        return "LEAD_CREATE";
    }

    @Override
    public boolean usesRegion() {
        return true;
    }

    @Override
    public String duplicateRule() {
        return "Skip rows whose email already exists (in the CRM or earlier in the file)";
    }

    @Override
    public List<ImportFieldSpec> fields() {
        return List.of(
                ImportFieldSpec.text("salutation", "Salutation", 16).aliases("title prefix", "mr/ms"),
                ImportFieldSpec.text("firstName", "First name", 100).aliases("fname", "given name"),
                ImportFieldSpec.text("lastName", "Last name", 100).aliases("lname", "surname", "family name"),
                ImportFieldSpec.text("companyName", "Company", 255)
                        .aliases("company name", "organization", "organisation", "account", "business name"),
                ImportFieldSpec.of("email", "Email", "EMAIL").max(255).aliases("email address", "e-mail", "mail"),
                ImportFieldSpec.of("secondaryEmail", "Secondary email", "EMAIL").max(255)
                        .aliases("alternate email", "other email"),
                ImportFieldSpec.of("phone", "Phone", "PHONE").max(50).aliases("phone number", "telephone", "tel"),
                ImportFieldSpec.of("mobile", "Mobile", "PHONE").max(50).aliases("mobile number", "cell", "cell phone"),
                ImportFieldSpec.of("fax", "Fax", "PHONE").max(50),
                ImportFieldSpec.of("website", "Website", "URL").max(255).aliases("web", "url", "site"),
                ImportFieldSpec.text("source", "Lead source", 64).aliases("source", "lead origin"),
                ImportFieldSpec.enumeration("status", "Status", STATUSES, "NEW").aliases("lead status"),
                ImportFieldSpec.enumeration("priority", "Priority", PRIORITIES, null),
                ImportFieldSpec.text("rating", "Rating", 32),
                ImportFieldSpec.text("industry", "Industry", 64).aliases("sector"),
                ImportFieldSpec.text("designation", "Designation", 128).aliases("title", "job title", "position"),
                ImportFieldSpec.of("noOfEmployees", "No. of employees", "INTEGER")
                        .aliases("employees", "number of employees", "company size", "headcount"),
                ImportFieldSpec.of("estimatedValue", "Estimated value", "DECIMAL")
                        .aliases("value", "amount", "deal value", "budget"),
                ImportFieldSpec.of("expectedCloseDate", "Expected close date", "DATE").aliases("close date"),
                ImportFieldSpec.of("emailOptOut", "Email opt-out", "BOOLEAN").aliases("opt out", "unsubscribed"),
                ImportFieldSpec.text("skypeId", "Skype ID", 128).aliases("skype"),
                ImportFieldSpec.text("twitter", "Twitter", 128).aliases("twitter handle", "x handle"),
                ImportFieldSpec.text("addressFlat", "Flat / building", 255).aliases("flat", "building", "address line 1"),
                ImportFieldSpec.text("addressStreet", "Street", 255).aliases("street address", "address", "address line 2"),
                ImportFieldSpec.text("addressCity", "City", 128).aliases("town"),
                ImportFieldSpec.text("addressState", "State", 128).aliases("province", "region state"),
                ImportFieldSpec.text("addressCountry", "Country", 128),
                ImportFieldSpec.text("addressZip", "Zip / postal code", 32)
                        .aliases("zip", "zip code", "postal code", "pincode", "pin code", "postcode"),
                ImportFieldSpec.region(),
                ImportFieldSpec.reference("ownerEmail", "Owner", "Owner's user email", "ownerId")
                        .aliases("owner email", "lead owner", "assigned to"),
                ImportFieldSpec.of("description", "Description", "TEXT").aliases("notes", "comments", "remarks"));
    }

    @Override
    public String importGroup(Context context, List<ImportRow> rows) {
        CurrentUser user = tenantAccess.requirePermission("LEAD_CREATE");
        tableAclEvaluator.requireTableAccess("lead", CrudOp.CREATE);
        ImportRow row = rows.get(0);
        CreateLeadRequest request = leadImportService.normalize(new CreateLeadRequest(
                    context.lookups().organizationId(),
                    context.regionOrDefault(row, "region"),
                    context.lookups().userByEmail(row.email("ownerEmail", "Owner email")),
                    row.text("salutation"),
                    row.text("firstName"),
                    row.text("lastName"),
                    row.text("companyName"),
                    row.text("email"),
                    row.text("phone"),
                    row.text("mobile"),
                    row.text("fax"),
                    row.text("website"),
                    row.text("source"),
                    row.bool("emailOptOut", "Email opt-out"),
                    row.integer("noOfEmployees", "No. of employees"),
                    row.text("rating"),
                    row.text("skypeId"),
                    row.email("secondaryEmail", "Secondary email"),
                    row.text("twitter"),
                    row.text("addressCountry"),
                    row.text("addressFlat"),
                    row.text("addressStreet"),
                    row.text("addressCity"),
                    row.text("addressState"),
                    row.text("addressZip"),
                    null,
                    null,
                    row.text("status"),
                    row.text("priority"),
                    row.text("industry"),
                    row.text("designation"),
                    row.decimal("estimatedValue", "Estimated value"),
                    row.date("expectedCloseDate", "Expected close date"),
                    row.text("description")));
        String email = request.email() == null ? null : request.email().toLowerCase(java.util.Locale.ROOT);
        if (context.skipDuplicates() && email != null) {
            if (!context.firstInFile("lead-email", email)) {
                return "Same email appears earlier in the file";
            }
            if (!leadRepository.findPotentialDuplicates(
                    context.lookups().organizationId(), email, null, PageRequest.of(0, 1)).isEmpty()) {
                return "A lead with this email already exists";
            }
        }
        leadService.createImportedLead(user, request);
        return null;
    }
}
