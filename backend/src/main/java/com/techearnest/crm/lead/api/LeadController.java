package com.techearnest.crm.lead.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.lead.api.dto.LeadDtos.AssignLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.ConvertLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.ConvertLeadResponse;
import com.techearnest.crm.lead.api.dto.LeadDtos.CreateLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.LeadResponse;
import com.techearnest.crm.lead.api.dto.LeadDtos.QueryLeadRequest;
import com.techearnest.crm.lead.api.dto.LeadDtos.UpdateLeadRequest;
import com.techearnest.crm.lead.application.LeadService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/leads")
public class LeadController {

    private final LeadService leadService;

    public LeadController(LeadService leadService) {
        this.leadService = leadService;
    }

    @GetMapping
    public ApiResponse<List<LeadResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) UUID ownerId,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Sort.Direction direction =
                "ASC".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String sortField = switch (sortBy) {
            case "status", "source", "priority", "estimatedValue", "companyName", "createdAt", "expectedCloseDate" ->
                    sortBy;
            default -> "createdAt";
        };
        var result = leadService.list(
                organizationId,
                search,
                status,
                source,
                priority,
                regionId,
                ownerId,
                PageRequest.of(page, Math.min(size, 100), Sort.by(direction, sortField)));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @PostMapping("/query")
    public ApiResponse<List<LeadResponse>> query(@RequestBody(required = false) QueryLeadRequest request) {
        var result = leadService.query(request);
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<String> export(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) List<String> columns) {
        String csv = leadService.exportCsv(organizationId, columns);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"leads.csv\"")
                .contentType(new MediaType("text", "csv"))
                .body(csv);
    }

    @GetMapping("/{id}")
    public ApiResponse<LeadResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(leadService.get(id));
    }

    @PostMapping
    public ApiResponse<LeadResponse> create(@Valid @RequestBody CreateLeadRequest request) {
        return ApiResponse.ok(leadService.create(request), "Lead created successfully");
    }

    @PostMapping("/import")
    public ApiResponse<Map<String, Integer>> importLeads(@Valid @RequestBody List<CreateLeadRequest> requests) {
        int count = leadService.importLeads(requests);
        return ApiResponse.ok(Map.of("imported", count), "Leads imported successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<LeadResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateLeadRequest request) {
        return ApiResponse.ok(leadService.update(id, request), "Lead updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        leadService.delete(id);
        return ApiResponse.ok(null, "Lead deleted successfully");
    }

    @PostMapping("/{id}/assign")
    public ApiResponse<LeadResponse> assign(
            @PathVariable UUID id, @Valid @RequestBody AssignLeadRequest request) {
        return ApiResponse.ok(leadService.assign(id, request), "Lead assigned successfully");
    }

    @PostMapping("/bulk-assign")
    public ApiResponse<com.techearnest.crm.lead.api.dto.LeadDtos.BulkLeadResult> bulkAssign(
            @Valid @RequestBody com.techearnest.crm.lead.api.dto.LeadDtos.BulkAssignLeadRequest request) {
        return ApiResponse.ok(leadService.bulkAssign(request), "Bulk assign completed");
    }

    @PostMapping("/bulk-status")
    public ApiResponse<com.techearnest.crm.lead.api.dto.LeadDtos.BulkLeadResult> bulkStatus(
            @Valid @RequestBody com.techearnest.crm.lead.api.dto.LeadDtos.BulkStatusLeadRequest request) {
        return ApiResponse.ok(leadService.bulkStatus(request), "Bulk status update completed");
    }

    @PostMapping("/duplicate-check")
    public ApiResponse<com.techearnest.crm.lead.api.dto.LeadDtos.DuplicateCheckResponse> duplicateCheck(
            @Valid @RequestBody com.techearnest.crm.lead.api.dto.LeadDtos.DuplicateCheckRequest request) {
        return ApiResponse.ok(leadService.checkDuplicates(request));
    }

    @PostMapping("/{id}/convert")
    public ApiResponse<ConvertLeadResponse> convert(
            @PathVariable UUID id, @Valid @RequestBody ConvertLeadRequest request) {
        return ApiResponse.ok(leadService.convert(id, request), "Lead converted successfully");
    }
}
