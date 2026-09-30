package com.techearnest.crm.timesheet.application;

import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.BulkActionResult;
import com.techearnest.crm.timesheet.api.dto.TimesheetDtos.RejectTimesheetRequest;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import org.springframework.stereotype.Service;

/**
 * Approves or rejects many timesheets at once. Deliberately not transactional: each timesheet goes through
 * {@link TimesheetService} in its own transaction, so one failure (wrong status, self-approval) is reported
 * without undoing the others.
 */
@Service
public class TimesheetBulkService {

    private final TimesheetService timesheetService;

    public TimesheetBulkService(TimesheetService timesheetService) {
        this.timesheetService = timesheetService;
    }

    public List<BulkActionResult> approveAll(List<UUID> ids) {
        return forEach(ids, timesheetService::approve);
    }

    public List<BulkActionResult> rejectAll(List<UUID> ids, String reason) {
        RejectTimesheetRequest request = new RejectTimesheetRequest(reason);
        return forEach(ids, id -> timesheetService.reject(id, request));
    }

    private static List<BulkActionResult> forEach(List<UUID> ids, Consumer<UUID> action) {
        List<BulkActionResult> results = new ArrayList<>();
        for (UUID id : new LinkedHashSet<>(ids)) {
            try {
                action.accept(id);
                results.add(new BulkActionResult(id, true, null));
            } catch (RuntimeException ex) {
                results.add(new BulkActionResult(id, false, ex.getMessage()));
            }
        }
        return results;
    }
}
