package com.techearnest.crm.importer.application.modules;

import com.techearnest.crm.importer.application.BulkImportService;
import com.techearnest.crm.importer.application.ImportFieldSpec;
import com.techearnest.crm.importer.application.ImportRow;
import com.techearnest.crm.importer.application.ModuleImporter;
import com.techearnest.crm.importer.application.RowRejected;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.AddPurchaseOrderItemRequest;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.CreatePurchaseOrderRequest;
import com.techearnest.crm.procurement.api.dto.PurchaseOrderDtos.PurchaseOrderResponse;
import com.techearnest.crm.procurement.application.PurchaseOrderService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * Creates draft purchase orders. Rows sharing the same PO number become one purchase order with several items;
 * header columns (vendor, project, currency, needed-by, notes) are read from the first row of the group.
 */
@Component
public class PurchaseOrderImporter implements ModuleImporter {

    static final String GROUP_KEY = "poNumber";

    private final PurchaseOrderService purchaseOrderService;
    private final BulkImportService bulkImportService;

    public PurchaseOrderImporter(
            PurchaseOrderService purchaseOrderService, @Lazy BulkImportService bulkImportService) {
        this.purchaseOrderService = purchaseOrderService;
        this.bulkImportService = bulkImportService;
    }

    @Override
    public String module() {
        return "purchase-orders";
    }

    @Override
    public String metadataTable() {
        return "purchase_order";
    }

    @Override
    public String importPermission() {
        return "PO_IMPORT";
    }

    @Override
    public String createPermission() {
        return "PO_CREATE";
    }

    @Override
    public List<ImportFieldSpec> fields() {
        return List.of(
                ImportFieldSpec.text(GROUP_KEY, "PO number", 80)
                        .aliases("po", "po no", "purchase order", "purchase order number", "order number"),
                ImportFieldSpec.reference("vendorName", "Vendor", "Vendor name", "vendorId").mandatory().header()
                        .aliases("vendor", "supplier", "supplier name"),
                ImportFieldSpec.reference("projectCode", "Project", "Project code or name", "projectId").header()
                        .aliases("project code"),
                ImportFieldSpec.of("currencyCode", "Currency", "TEXT").max(3).header().aliases("currency code"),
                ImportFieldSpec.of("neededBy", "Needed by", "DATE").header()
                        .aliases("needed by date", "required by", "delivery date"),
                ImportFieldSpec.of("itemDescription", "Item description", "TEXT").max(500)
                        .aliases("description", "item", "product"),
                ImportFieldSpec.of("quantity", "Quantity", "DECIMAL").aliases("qty", "units"),
                ImportFieldSpec.of("unitPrice", "Unit price", "DECIMAL").aliases("rate", "price", "unit rate"),
                ImportFieldSpec.reference("taxRate", "Tax rate", "Tax rate code or name", "taxRateId")
                        .aliases("tax", "gst", "vat"),
                ImportFieldSpec.region().header(),
                ImportFieldSpec.reference("requesterEmail", "Requester", "Requester's user email", "requesterId")
                        .header().aliases("requester email", "requested by"),
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
    public String duplicateRule() {
        return "Skip purchase orders whose PO number already exists (otherwise they are reported as failed)";
    }

    @Override
    public String importGroup(Context context, List<ImportRow> rows) {
        ImportRow header = rows.get(0);
        String poNumber = header.text(GROUP_KEY);
        if (poNumber != null && context.lookups().exists(
                "select count(p) from PurchaseOrder p where p.organizationId = :org and p.deletedAt is null"
                        + " and lower(p.poNumber) = :number", "number", poNumber.toLowerCase(Locale.ROOT))) {
            if (context.skipDuplicates()) {
                return "A purchase order with this number already exists";
            }
            throw new RowRejected("PO number '" + poNumber + "' already exists");
        }
        String currency = header.text("currencyCode");
        if (currency != null && !currency.matches("(?i)[a-z]{3}")) {
            throw new RowRejected("Currency '" + currency + "' must be a 3-letter code such as INR or USD");
        }
        PurchaseOrderResponse po = purchaseOrderService.createDraft(bulkImportService.validated(
                new CreatePurchaseOrderRequest(
                        context.lookups().organizationId(),
                        context.regionOrDefault(header, "region"),
                        context.lookups().vendor(header.required("vendorName", "Vendor")),
                        context.lookups().project(header.text("projectCode")),
                        context.lookups().userByEmail(header.email("requesterEmail", "Requester email")),
                        poNumber,
                        currency == null ? null : currency.toUpperCase(Locale.ROOT),
                        header.date("neededBy", "Needed by"),
                        header.text("notes"))));
        for (ImportRow row : rows) {
            addItem(context, po.id(), row);
        }
        return null;
    }

    private void addItem(Context context, UUID poId, ImportRow row) {
        String description = row.text("itemDescription");
        BigDecimal quantity = row.decimal("quantity", "Quantity");
        BigDecimal unitPrice = row.decimal("unitPrice", "Unit price");
        if (description == null && quantity == null && unitPrice == null) {
            return;
        }
        if (description == null || quantity == null || unitPrice == null) {
            throw new RowRejected("Item needs a description, quantity and unit price");
        }
        purchaseOrderService.addItem(poId, bulkImportService.validated(new AddPurchaseOrderItemRequest(
                description, quantity, unitPrice, context.lookups().taxRate(row.text("taxRate")))));
    }
}
