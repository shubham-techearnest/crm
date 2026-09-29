package com.techearnest.crm.importer.application.modules;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techearnest.crm.account.api.dto.AccountDtos.CreateAccountRequest;
import com.techearnest.crm.account.application.AccountService;
import com.techearnest.crm.importer.application.BulkImportService;
import com.techearnest.crm.importer.application.ImportFieldSpec;
import com.techearnest.crm.importer.application.ImportRow;
import com.techearnest.crm.importer.application.ModuleImporter;
import com.techearnest.crm.importer.application.RowRejected;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

@Component
public class AccountImporter implements ModuleImporter {

    private static final Set<String> STATUSES = Set.of("ACTIVE", "INACTIVE");
    private static final Set<String> TYPES = Set.of("PROSPECT", "CUSTOMER", "PARTNER", "VENDOR", "OTHER");

    private final AccountService accountService;
    private final BulkImportService bulkImportService;
    private final ObjectMapper objectMapper;

    public AccountImporter(
            AccountService accountService, @Lazy BulkImportService bulkImportService, ObjectMapper objectMapper) {
        this.accountService = accountService;
        this.bulkImportService = bulkImportService;
        this.objectMapper = objectMapper;
    }

    @Override
    public String module() {
        return "accounts";
    }

    @Override
    public String metadataTable() {
        return "account";
    }

    @Override
    public String importPermission() {
        return "ACCOUNT_IMPORT";
    }

    @Override
    public List<ImportFieldSpec> fields() {
        return List.of(
                ImportFieldSpec.text("name", "Account name", 255).mandatory()
                        .aliases("account", "company", "company name", "organization", "organisation", "customer"),
                ImportFieldSpec.enumeration("accountType", "Account type", TYPES.stream().sorted().toList(), "PROSPECT")
                        .aliases("type"),
                ImportFieldSpec.text("industry", "Industry", 64).aliases("sector"),
                ImportFieldSpec.of("website", "Website", "URL").max(255).aliases("web", "url", "site"),
                ImportFieldSpec.of("email", "Email", "EMAIL").max(255).aliases("email address", "e-mail"),
                ImportFieldSpec.of("phone", "Phone", "PHONE").max(50).aliases("phone number", "telephone"),
                ImportFieldSpec.of("billingAddress", "Billing address", "TEXT").aliases("address"),
                ImportFieldSpec.of("shippingAddress", "Shipping address", "TEXT").aliases("delivery address"),
                ImportFieldSpec.text("taxNumber", "Tax number", 64).aliases("gst", "gstin", "vat", "tax id", "pan"),
                ImportFieldSpec.enumeration("status", "Status", STATUSES.stream().sorted().toList(), "ACTIVE"),
                ImportFieldSpec.region(),
                ImportFieldSpec.reference("ownerEmail", "Owner", "Owner's user email", "ownerId")
                        .aliases("owner email", "account owner"),
                ImportFieldSpec.of("description", "Description", "TEXT").aliases("notes", "comments"));
    }

    @Override
    public boolean usesRegion() {
        return true;
    }

    @Override
    public String duplicateRule() {
        return "Skip rows whose account name already exists (in the CRM or earlier in the file)";
    }

    @Override
    public String createPermission() {
        return "ACCOUNT_CREATE";
    }

    @Override
    public String importGroup(Context context, List<ImportRow> rows) {
        ImportRow row = rows.get(0);
        String name = row.required("name", "Account name");
        if (context.skipDuplicates()) {
            String key = name.toLowerCase(Locale.ROOT);
            if (!context.firstInFile("account-name", key)) {
                return "Same account name appears earlier in the file";
            }
            if (context.lookups().exists(
                    "select count(a) from Account a where a.organizationId = :org and a.deletedAt is null"
                            + " and lower(a.name) = :name", "name", key)) {
                return "An account with this name already exists";
            }
        }
        accountService.create(bulkImportService.validated(new CreateAccountRequest(
                context.lookups().organizationId(),
                context.regionOrDefault(row, "region"),
                context.lookups().userByEmail(row.text("ownerEmail")),
                name,
                row.text("industry"),
                row.text("website"),
                row.email("email", "Email"),
                row.text("phone"),
                address(row.text("billingAddress")),
                address(row.text("shippingAddress")),
                row.text("taxNumber"),
                row.code("status", "Status", STATUSES, "ACTIVE"),
                row.code("accountType", "Account type", TYPES, "PROSPECT"),
                row.text("description"))));
        return null;
    }

    /** Addresses are stored as jsonb; a spreadsheet gives a single free-text line. */
    private String address(String text) {
        if (text == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(Map.of("street", text));
        } catch (JsonProcessingException e) {
            throw new RowRejected("Address could not be read");
        }
    }
}
