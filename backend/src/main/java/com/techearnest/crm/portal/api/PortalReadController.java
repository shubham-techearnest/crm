package com.techearnest.crm.portal.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.portal.application.PortalReadService;
import com.techearnest.crm.portal.application.PortalReadService.PortalDocumentSummary;
import com.techearnest.crm.portal.application.PortalReadService.PortalInvoiceSummary;
import com.techearnest.crm.portal.application.PortalReadService.PortalProjectSummary;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/portal")
public class PortalReadController {

    private final PortalReadService portalReadService;

    public PortalReadController(PortalReadService portalReadService) {
        this.portalReadService = portalReadService;
    }

    @GetMapping("/projects")
    public ApiResponse<List<PortalProjectSummary>> projects() {
        return ApiResponse.ok(portalReadService.listProjects());
    }

    @GetMapping("/invoices")
    public ApiResponse<List<PortalInvoiceSummary>> invoices() {
        return ApiResponse.ok(portalReadService.listInvoices());
    }

    @GetMapping("/documents")
    public ApiResponse<List<PortalDocumentSummary>> documents() {
        return ApiResponse.ok(portalReadService.listDocuments());
    }
}
