-- A timesheet can span projects with different project managers; each manager approves only
-- the hours on their own projects, so approval is tracked per entry.
ALTER TABLE time_entries
    ADD COLUMN approved_by UUID,
    ADD COLUMN approved_at TIMESTAMPTZ;

UPDATE time_entries e
SET approved_by = t.approved_by,
    approved_at = t.approved_at
FROM timesheets t
WHERE e.timesheet_id = t.id
  AND t.status = 'APPROVED';
