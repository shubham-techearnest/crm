package com.techearnest.crm.timesheet.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.ProjectTimeSummary;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.ResourceTimeSummary;
import com.techearnest.crm.timesheet.application.TimeTrackingService;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class TimeTrackingController {

    private final TimeTrackingService timeTrackingService;

    public TimeTrackingController(TimeTrackingService timeTrackingService) {
        this.timeTrackingService = timeTrackingService;
    }

    @GetMapping("/projects/{id}/time-summary")
    public ApiResponse<ProjectTimeSummary> projectSummary(@PathVariable UUID id) {
        return ApiResponse.ok(timeTrackingService.projectSummary(id));
    }

    @GetMapping("/resources/{id}/time-summary")
    public ApiResponse<ResourceTimeSummary> resourceSummary(
            @PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.ok(timeTrackingService.resourceSummary(id, from, to));
    }
}
