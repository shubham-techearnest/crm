package com.techearnest.crm.importer.application.modules;

import com.techearnest.crm.deal.api.dto.DealDtos.CreateDealRequest;
import com.techearnest.crm.deal.application.DealService;
import com.techearnest.crm.importer.application.BulkImportService;
import com.techearnest.crm.importer.application.ImportFieldSpec;
import com.techearnest.crm.importer.application.ImportRow;
import com.techearnest.crm.importer.application.ModuleImporter;
import com.techearnest.crm.importer.application.RowRejected;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

@Component
public class DealImporter implements ModuleImporter {

    private static final Set<String> STAGES =
            Set.of("NEW", "QUALIFICATION", "REQUIREMENT", "PROPOSAL", "NEGOTIATION", "WON", "LOST");

    private final DealService dealService;
    private final BulkImportService bulkImportService;

    public DealImporter(DealService dealService, @Lazy BulkImportService bulkImportService) {
        this.dealService = dealService;
        this.bulkImportService = bulkImportService;
    }

    @Override
    public String module() {
        return "deals";
    }

    @Override
    public String metadataTable() {
        return "deal";
    }

    @Override
    public String importPermission() {
        return "DEAL_IMPORT";
    }

    @Override
    public List<ImportFieldSpec> fields() {
        return List.of(
                ImportFieldSpec.text("name", "Deal name", 255).mandatory().aliases("deal", "opportunity", "opportunity name"),
                ImportFieldSpec.reference("accountName", "Account", "Account name", "accountId").mandatory()
                        .aliases("company", "company name", "customer", "organization"),
                ImportFieldSpec.enumeration("stage", "Stage",
                        List.of("NEW", "QUALIFICATION", "REQUIREMENT", "PROPOSAL", "NEGOTIATION", "WON", "LOST"), "NEW")
                        .aliases("deal stage", "pipeline stage"),
                ImportFieldSpec.of("value", "Value", "DECIMAL").aliases("amount", "deal value", "deal amount"),
                ImportFieldSpec.of("probability", "Probability (%)", "DECIMAL").aliases("win probability"),
                ImportFieldSpec.of("expectedCloseDate", "Expected close date", "DATE").aliases("close date", "closing date"),
                ImportFieldSpec.text("source", "Source", 64).aliases("lead source", "deal source"),
                ImportFieldSpec.reference("contactEmail", "Contact", "Contact's email", "contactId")
                        .aliases("contact email", "contact person"),
                ImportFieldSpec.reference("ownerEmail", "Owner", "Owner's user email", "ownerId")
                        .aliases("owner email", "deal owner"),
                ImportFieldSpec.text("competitor", "Competitor", 255),
                ImportFieldSpec.of("description", "Description", "TEXT").aliases("notes", "comments"));
    }

    @Override
    public String duplicateRule() {
        return "Skip rows whose deal name already exists for the same account";
    }

    @Override
    public String createPermission() {
        return "DEAL_CREATE";
    }

    @Override
    public String importGroup(Context context, List<ImportRow> rows) {
        ImportRow row = rows.get(0);
        String name = row.required("name", "Deal name");
        UUID accountId = context.lookups().account(row.required("accountName", "Account"));
        if (context.skipDuplicates()) {
            String key = name.toLowerCase(Locale.ROOT);
            if (!context.firstInFile("deal", accountId + "|" + key)) {
                return "Same deal name for this account appears earlier in the file";
            }
            if (context.lookups().exists(
                    "select count(d) from Deal d where d.organizationId = :org and d.deletedAt is null"
                            + " and d.accountId = :account and lower(d.name) = :name",
                    "account", accountId, "name", key)) {
                return "A deal with this name already exists for the account";
            }
        }
        BigDecimal probability = row.decimal("probability", "Probability");
        if (probability != null && probability.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new RowRejected("Probability must be between 0 and 100");
        }
        dealService.create(bulkImportService.validated(new CreateDealRequest(
                context.lookups().organizationId(),
                accountId,
                context.lookups().contactByEmail(row.text("contactEmail")),
                context.lookups().userByEmail(row.text("ownerEmail")),
                null,
                name,
                row.code("stage", "Stage", STAGES, "NEW"),
                row.decimal("value", "Value"),
                probability,
                row.date("expectedCloseDate", "Expected close date"),
                row.text("source"),
                row.text("description"),
                row.text("competitor"))));
        return null;
    }
}
