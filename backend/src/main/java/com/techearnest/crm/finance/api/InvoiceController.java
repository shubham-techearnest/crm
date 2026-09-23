package com.techearnest.crm.finance.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.AddManualLineRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.CreateInvoiceRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.InvoiceResponse;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.IssueInvoiceRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.PullTimeEntriesRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.QueryInvoiceRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.RecordPaymentRequest;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.UnbilledTimeEntryResponse;
import com.techearnest.crm.finance.application.InvoiceService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;

    public InvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

    @GetMapping
    public ApiResponse<List<InvoiceResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(defaultValue = "false") boolean overdueOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = invoiceService.list(
                organizationId,
                search,
                status,
                accountId,
                projectId,
                overdueOnly,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @PostMapping("/query")
    public ApiResponse<List<InvoiceResponse>> query(@RequestBody(required = false) QueryInvoiceRequest request) {
        var result = invoiceService.query(request);
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping("/unbilled-time")
    public ApiResponse<List<UnbilledTimeEntryResponse>> unbilled(
            @RequestParam(required = false) UUID projectId) {
        return ApiResponse.ok(invoiceService.listUnbilled(projectId));
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public String export(@RequestParam(required = false) UUID organizationId) {
        return invoiceService.exportCsv(organizationId);
    }

    @GetMapping("/{id}")
    public ApiResponse<InvoiceResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(invoiceService.get(id));
    }

    @PostMapping
    public ApiResponse<InvoiceResponse> create(@Valid @RequestBody CreateInvoiceRequest request) {
        return ApiResponse.ok(invoiceService.createDraft(request), "Invoice draft created");
    }

    @PostMapping("/{id}/lines")
    public ApiResponse<InvoiceResponse> addLine(
            @PathVariable UUID id, @Valid @RequestBody AddManualLineRequest request) {
        return ApiResponse.ok(invoiceService.addManualLine(id, request), "Line added");
    }

    @PostMapping("/{id}/lines/from-time")
    public ApiResponse<InvoiceResponse> pullTime(
            @PathVariable UUID id, @Valid @RequestBody PullTimeEntriesRequest request) {
        return ApiResponse.ok(invoiceService.pullTimeEntries(id, request), "Time entries pulled");
    }

    @PostMapping("/{id}/issue")
    public ApiResponse<InvoiceResponse> issue(
            @PathVariable UUID id, @RequestBody(required = false) IssueInvoiceRequest request) {
        return ApiResponse.ok(invoiceService.issue(id, request), "Invoice issued");
    }

    @PostMapping("/{id}/void")
    public ApiResponse<InvoiceResponse> voidInvoice(@PathVariable UUID id) {
        return ApiResponse.ok(invoiceService.voidInvoice(id), "Invoice voided");
    }

    @PostMapping("/{id}/payments")
    public ApiResponse<InvoiceResponse> pay(
            @PathVariable UUID id, @Valid @RequestBody RecordPaymentRequest request) {
        return ApiResponse.ok(invoiceService.recordPayment(id, request), "Payment recorded");
    }
}
