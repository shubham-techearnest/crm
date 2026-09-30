package com.techearnest.crm.finance.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.finance.api.dto.InvoiceDtos.InvoiceResponse;
import com.techearnest.crm.finance.api.dto.ProjectBillingDtos.ProjectInvoicePreview;
import com.techearnest.crm.finance.api.dto.ProjectBillingDtos.ProjectInvoiceRequest;
import com.techearnest.crm.finance.application.ProjectBillingService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/invoices")
public class ProjectBillingController {

    private final ProjectBillingService billingService;

    public ProjectBillingController(ProjectBillingService billingService) {
        this.billingService = billingService;
    }

    @PostMapping("/preview")
    public ApiResponse<ProjectInvoicePreview> preview(
            @PathVariable UUID projectId, @Valid @RequestBody(required = false) ProjectInvoiceRequest request) {
        return ApiResponse.ok(billingService.preview(projectId, request));
    }

    @PostMapping("/generate")
    public ApiResponse<InvoiceResponse> generate(
            @PathVariable UUID projectId, @Valid @RequestBody(required = false) ProjectInvoiceRequest request) {
        return ApiResponse.ok(billingService.generate(projectId, request), "Draft invoice generated");
    }
}
