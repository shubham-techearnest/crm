package com.techearnest.crm.timesheet.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.IssueTimesheetLinkRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.LinkSubmitRequest;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimesheetLinkIssued;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimesheetLinkView;
import com.techearnest.crm.timesheet.application.TimesheetLinkService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class TimesheetLinkController {

    private final TimesheetLinkService linkService;

    public TimesheetLinkController(TimesheetLinkService linkService) {
        this.linkService = linkService;
    }

    @PostMapping("/resources/{resourceId}/timesheet-links")
    public ApiResponse<TimesheetLinkIssued> issue(
            @PathVariable UUID resourceId, @Valid @RequestBody IssueTimesheetLinkRequest request) {
        TimesheetLinkIssued issued = linkService.issue(resourceId, request);
        return ApiResponse.ok(issued, issued.emailed() ? "Timesheet link emailed" : "Timesheet link created");
    }

    /** Public: authenticated by the link token itself. */
    @GetMapping("/public/timesheet-links/{token}")
    public ApiResponse<TimesheetLinkView> view(@PathVariable String token) {
        return ApiResponse.ok(linkService.view(token));
    }

    /** Public: authenticated by the link token itself. */
    @PostMapping("/public/timesheet-links/{token}/submit")
    public ApiResponse<TimesheetLinkView> submit(
            @PathVariable String token, @Valid @RequestBody LinkSubmitRequest request) {
        return ApiResponse.ok(linkService.submit(token, request), "Timesheet submitted for approval");
    }
}
