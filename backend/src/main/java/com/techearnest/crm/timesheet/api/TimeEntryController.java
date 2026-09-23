package com.techearnest.crm.timesheet.api;

import com.techearnest.crm.common.api.ApiResponse;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.TimeEntryResponse;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.UpdateTimeEntryRequest;
import com.techearnest.crm.timesheet.application.TimesheetService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/time-entries")
public class TimeEntryController {

    private final TimesheetService timesheetService;

    public TimeEntryController(TimesheetService timesheetService) {
        this.timesheetService = timesheetService;
    }

    @PutMapping("/{id}")
    public ApiResponse<TimeEntryResponse> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateTimeEntryRequest request) {
        return ApiResponse.ok(timesheetService.updateEntry(id, request), "Time entry updated successfully");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        timesheetService.deleteEntry(id);
        return ApiResponse.ok(null, "Time entry deleted successfully");
    }
}
