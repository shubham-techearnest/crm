package com.techearnest.crm.finance.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.finance.api.dto.CreditNoteDtos.CreateCreditNoteRequest;
import com.techearnest.crm.finance.api.dto.CreditNoteDtos.CreditNoteResponse;
import com.techearnest.crm.finance.application.CreditNoteService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CreditNoteController {

    private final CreditNoteService creditNoteService;

    public CreditNoteController(CreditNoteService creditNoteService) {
        this.creditNoteService = creditNoteService;
    }

    @GetMapping("/invoices/{invoiceId}/credit-notes")
    public ApiResponse<List<CreditNoteResponse>> list(@PathVariable UUID invoiceId) {
        return ApiResponse.ok(creditNoteService.listForInvoice(invoiceId));
    }

    @PostMapping("/invoices/{invoiceId}/credit-notes")
    public ApiResponse<CreditNoteResponse> create(
            @PathVariable UUID invoiceId, @Valid @RequestBody CreateCreditNoteRequest request) {
        return ApiResponse.ok(creditNoteService.create(invoiceId, request), "Credit note created");
    }

    @GetMapping("/credit-notes/{id}")
    public ApiResponse<CreditNoteResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(creditNoteService.get(id));
    }

    @PostMapping("/credit-notes/{id}/issue")
    public ApiResponse<CreditNoteResponse> issue(@PathVariable UUID id) {
        return ApiResponse.ok(creditNoteService.issue(id), "Credit note issued");
    }

    @PostMapping("/credit-notes/{id}/apply")
    public ApiResponse<CreditNoteResponse> apply(@PathVariable UUID id) {
        return ApiResponse.ok(creditNoteService.apply(id), "Credit note applied");
    }
}
