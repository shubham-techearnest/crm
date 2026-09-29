package com.techearnest.crm.importer.application.modules;

import com.techearnest.crm.finance.api.dto.InvoiceDtos.AddManualLineRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.CreateInvoiceRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.InvoiceResponse;
import com.techearnest.crm.finance.application.InvoiceService;
import com.techearnest.crm.importer.application.BulkImportService;
import com.techearnest.crm.importer.application.ImportFieldSpec;
import com.techearnest.crm.importer.application.ImportRow;
import com.techearnest.crm.importer.application.ModuleImporter;
import com.techearnest.crm.importer.application.RowRejected;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * Creates draft invoices. Rows sharing the same "Invoice reference" become one invoice with several lines;
 * header columns (account, project, currency, due date, notes) are read from the first row of the group.
 */
@Component
public class InvoiceImporter implements ModuleImporter {

    static final String GROUP_KEY = "reference";

    private final InvoiceService invoiceService;
    private final BulkImportService bulkImportService;

    public InvoiceImporter(InvoiceService invoiceService, @Lazy BulkImportService bulkImportService) {
        this.invoiceService = invoiceService;
        this.bulkImportService = bulkImportService;
    }

    @Override
    public String module() {
        return "invoices";
    }

    @Override
    public String metadataTable() {
        return "invoice";
    }

    @Override
    public String importPermission() {
        return "INVOICE_IMPORT";
    }

    @Override
    public String createPermission() {
        return "INVOICE_CREATE";
    }

    @Override
    public List<ImportFieldSpec> fields() {
        return List.of(
                ImportFieldSpec.text(GROUP_KEY, "Invoice reference", 80)
                        .aliases("reference", "ref", "invoice ref", "invoice", "invoice no", "invoice number"),
                ImportFieldSpec.reference("accountName", "Account", "Account name", "accountId").mandatory().header()
                        .aliases("client", "customer", "company", "bill to"),
                ImportFieldSpec.reference("projectCode", "Project", "Project code or name", "projectId").header()
                        .aliases("project code"),
                ImportFieldSpec.of("currencyCode", "Currency", "TEXT").max(3).header().aliases("currency code"),
                ImportFieldSpec.of("dueDate", "Due date", "DATE").header().aliases("payment due"),
                ImportFieldSpec.of("lineDescription", "Line description", "TEXT").max(500)
                        .aliases("description", "item", "line", "service"),
                ImportFieldSpec.of("quantity", "Quantity", "DECIMAL").aliases("qty", "units"),
                ImportFieldSpec.of("unitPrice", "Unit price", "DECIMAL").aliases("rate", "price", "unit rate"),
                ImportFieldSpec.reference("taxRate", "Tax rate", "Tax rate code or name", "taxRateId")
                        .aliases("tax", "gst", "vat"),
                ImportFieldSpec.region().header(),
                ImportFieldSpec.of("notes", "Notes", "TEXT").header().aliases("remarks", "comments"));
    }

    @Override
    public boolean usesRegion() {
        return true;
    }

    @Override
    public String groupKey() {
        return GROUP_KEY;
    }

    @Override
    public String importGroup(Context context, List<ImportRow> rows) {
        ImportRow header = rows.get(0);
        String currency = header.text("currencyCode");
        if (currency != null && !currency.matches("(?i)[a-z]{3}")) {
            throw new RowRejected("Currency '" + currency + "' must be a 3-letter code such as INR or USD");
        }
        InvoiceResponse invoice = invoiceService.createDraft(bulkImportService.validated(new CreateInvoiceRequest(
                context.lookups().organizationId(),
                context.regionOrDefault(header, "region"),
                context.lookups().account(header.required("accountName", "Account")),
                context.lookups().project(header.text("projectCode")),
                currency == null ? null : currency.toUpperCase(Locale.ROOT),
                header.date("dueDate", "Due date"),
                header.text("notes"))));
        for (ImportRow row : rows) {
            addLine(context, invoice.id(), row);
        }
        return null;
    }

    private void addLine(Context context, UUID invoiceId, ImportRow row) {
        String description = row.text("lineDescription");
        BigDecimal quantity = row.decimal("quantity", "Quantity");
        BigDecimal unitPrice = row.decimal("unitPrice", "Unit price");
        if (description == null && quantity == null && unitPrice == null) {
            return;
        }
        if (description == null || quantity == null || unitPrice == null) {
            throw new RowRejected("Line needs a description, quantity and unit price");
        }
        if (quantity.signum() == 0) {
            throw new RowRejected("Quantity must be greater than 0");
        }
        invoiceService.addManualLine(invoiceId, bulkImportService.validated(new AddManualLineRequest(
                description, quantity, unitPrice, context.lookups().taxRate(row.text("taxRate")))));
    }
}
