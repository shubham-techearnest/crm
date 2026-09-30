package com.techearnest.crm.timesheet.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.BulkActionResult;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.BulkApproveRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.BulkRejectRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.CreateTimeEntryRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.SaveEntriesRequest;
import com.techearnest.crm.timesheet.application.TimesheetBulkService;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.CreateTimesheetRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.EntryProjectOption;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.RejectTimesheetRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimeEntryResponse;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimesheetResponse;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.UpdateTimesheetRequest;
import com.techearnest.crm.timesheet.application.TimesheetService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/timesheets")
public class TimesheetController {

    private final TimesheetService timesheetService;
    private final TimesheetBulkService bulkService;

    public TimesheetController(TimesheetService timesheetService, TimesheetBulkService bulkService) {
        this.timesheetService = timesheetService;
        this.bulkService = bulkService;
    }

    @GetMapping
    public ApiResponse<List<TimesheetResponse>> list(
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID resourceId,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
                    java.time.LocalDate weekStart,
            @RequestParam(required = false, defaultValue = "false") boolean billableOnly,
            @RequestParam(required = false, defaultValue = "false") boolean awaitingMyApproval,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var result = timesheetService.list(
                organizationId,
                status,
                resourceId,
                weekStart,
                billableOnly,
                awaitingMyApproval,
                PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "weekStartDate")));
        return ApiResponse.page(result.data(), result.pagination());
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<String> export(@RequestParam(required = false) UUID organizationId) {
        String csv = timesheetService.exportCsv(organizationId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"timesheets.csv\"")
                .contentType(new MediaType("text", "csv"))
                .body(csv);
    }

    @GetMapping("/{id}")
    public ApiResponse<TimesheetResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(timesheetService.get(id));
    }

    @GetMapping("/entry-projects")
    public ApiResponse<List<EntryProjectOption>> entryProjectsForResource(@RequestParam(required = false) UUID resourceId) {
        return ApiResponse.ok(timesheetService.entryProjectsForResource(resourceId));
    }

    @GetMapping("/{id}/projects")
    public ApiResponse<List<EntryProjectOption>> entryProjects(@PathVariable UUID id) {
        return ApiResponse.ok(timesheetService.entryProjects(id));
    }

    @PostMapping
    public ApiResponse<TimesheetResponse> create(@Valid @RequestBody CreateTimesheetRequest request) {
        return ApiResponse.ok(timesheetService.create(request), "Timesheet created successfully");
    }

    @PutMapping("/{id}")
    public ApiResponse<TimesheetResponse> update(
            @PathVariable UUID id, @RequestBody(required = false) UpdateTimesheetRequest request) {
        return ApiResponse.ok(
                timesheetService.update(id, request != null ? request : new UpdateTimesheetRequest(null, null)),
                "Timesheet updated successfully");
    }

    @PostMapping("/{id}/entries")
    public ApiResponse<TimeEntryResponse> addEntry(
            @PathVariable UUID id, @Valid @RequestBody CreateTimeEntryRequest request) {
        return ApiResponse.ok(timesheetService.addEntry(id, request), "Time entry added successfully");
    }

    @PutMapping("/{id}/entries")
    public ApiResponse<TimesheetResponse> saveEntries(
            @PathVariable UUID id, @Valid @RequestBody SaveEntriesRequest request) {
        return ApiResponse.ok(timesheetService.saveEntries(id, request.entries()), "Timesheet saved successfully");
    }

    @PostMapping("/{id}/copy-previous-week")
    public ApiResponse<TimesheetResponse> copyPreviousWeek(@PathVariable UUID id) {
        return ApiResponse.ok(timesheetService.copyPreviousWeek(id), "Previous week copied");
    }

    @PostMapping("/bulk-approve")
    public ApiResponse<List<BulkActionResult>> bulkApprove(@Valid @RequestBody BulkApproveRequest request) {
        return ApiResponse.ok(bulkService.approveAll(request.ids()));
    }

    @PostMapping("/bulk-reject")
    public ApiResponse<List<BulkActionResult>> bulkReject(@Valid @RequestBody BulkRejectRequest request) {
        return ApiResponse.ok(bulkService.rejectAll(request.ids(), request.reason()));
    }

    @PostMapping("/{id}/submit")
    public ApiResponse<TimesheetResponse> submit(@PathVariable UUID id) {
        return ApiResponse.ok(timesheetService.submit(id), "Timesheet submitted successfully");
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<TimesheetResponse> approve(@PathVariable UUID id) {
        return ApiResponse.ok(timesheetService.approve(id), "Timesheet approved successfully");
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<TimesheetResponse> reject(
            @PathVariable UUID id, @Valid @RequestBody RejectTimesheetRequest request) {
        return ApiResponse.ok(timesheetService.reject(id, request), "Timesheet rejected successfully");
    }
}
