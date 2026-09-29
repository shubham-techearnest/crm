package com.techearnest.crm.importer.application.modules;

import com.techearnest.crm.contact.api.dto.ContactDtos.CreateContactRequest;
import com.techearnest.crm.contact.application.ContactService;
import com.techearnest.crm.importer.application.BulkImportService;
import com.techearnest.crm.importer.application.ImportFieldSpec;
import com.techearnest.crm.importer.application.ImportRow;
import com.techearnest.crm.importer.application.ModuleImporter;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

@Component
public class ContactImporter implements ModuleImporter {

    private static final Set<String> STATUSES = Set.of("ACTIVE", "INACTIVE");

    private final ContactService contactService;
    private final BulkImportService bulkImportService;

    public ContactImporter(ContactService contactService, @Lazy BulkImportService bulkImportService) {
        this.contactService = contactService;
        this.bulkImportService = bulkImportService;
    }

    @Override
    public String module() {
        return "contacts";
    }

    @Override
    public String metadataTable() {
        return "contact";
    }

    @Override
    public String importPermission() {
        return "CONTACT_IMPORT";
    }

    @Override
    public List<ImportFieldSpec> fields() {
        return List.of(
                ImportFieldSpec.reference("accountName", "Account", "Account name", "accountId").mandatory()
                        .aliases("company", "company name", "organization", "organisation"),
                ImportFieldSpec.text("firstName", "First name", 100).mandatory().aliases("fname", "given name"),
                ImportFieldSpec.text("lastName", "Last name", 100).mandatory().aliases("lname", "surname", "family name"),
                ImportFieldSpec.of("email", "Email", "EMAIL").max(255).aliases("email address", "e-mail", "mail"),
                ImportFieldSpec.of("phone", "Phone", "PHONE").max(50).aliases("phone number", "telephone", "tel"),
                ImportFieldSpec.of("mobile", "Mobile", "PHONE").max(50).aliases("mobile number", "cell", "cell phone"),
                ImportFieldSpec.text("designation", "Designation", 128).aliases("title", "job title", "position"),
                ImportFieldSpec.text("department", "Department", 128),
                ImportFieldSpec.of("linkedinUrl", "LinkedIn URL", "URL").max(255).aliases("linkedin", "linkedin profile"),
                ImportFieldSpec.enumeration("status", "Status", STATUSES.stream().sorted().toList(), "ACTIVE"),
                ImportFieldSpec.reference("ownerEmail", "Owner", "Owner's user email", "ownerId")
                        .aliases("owner email", "contact owner"),
                ImportFieldSpec.of("notes", "Notes", "TEXT").aliases("description", "comments"));
    }

    @Override
    public String duplicateRule() {
        return "Skip rows whose email already exists (in the CRM or earlier in the file)";
    }

    @Override
    public String createPermission() {
        return "CONTACT_CREATE";
    }

    @Override
    public String importGroup(Context context, List<ImportRow> rows) {
        ImportRow row = rows.get(0);
        String email = row.email("email", "Email");
        if (context.skipDuplicates() && email != null) {
            if (!context.firstInFile("contact-email", email)) {
                return "Same email appears earlier in the file";
            }
            if (context.lookups().exists(
                    "select count(c) from Contact c where c.organizationId = :org and c.deletedAt is null"
                            + " and lower(c.email) = :email", "email", email)) {
                return "A contact with this email already exists";
            }
        }
        UUID accountId = context.lookups().account(row.required("accountName", "Account"));
        UUID ownerId = context.lookups().userByEmail(row.text("ownerEmail"));
        contactService.create(bulkImportService.validated(new CreateContactRequest(
                context.lookups().organizationId(),
                accountId,
                ownerId,
                row.required("firstName", "First name"),
                row.required("lastName", "Last name"),
                email,
                row.text("phone"),
                row.text("mobile"),
                row.text("designation"),
                row.text("department"),
                row.text("linkedinUrl"),
                row.code("status", "Status", STATUSES, "ACTIVE"),
                row.text("notes"))));
        return null;
    }
}
