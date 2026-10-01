-- Timesheet list: more columns to choose from in Manage Columns and a readable default layout.

INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, active, is_system, sort_order)
SELECT v.id::uuid, NULL, 'c1000001-0000-4000-8000-00000000000d'::uuid, v.code, v.label, NULL, v.field_type, FALSE, TRUE, TRUE, v.sort_order
FROM (VALUES
    ('c2000046-0000-4000-8000-000000000001', 'totalHours', 'Hours', 'NUMBER', 40),
    ('c2000046-0000-4000-8000-000000000002', 'entrySource', 'Entered', 'STRING', 50),
    ('c2000046-0000-4000-8000-000000000003', 'submittedAt', 'Submitted', 'DATETIME', 60),
    ('c2000046-0000-4000-8000-000000000004', 'approvedAt', 'Approved', 'DATETIME', 70),
    ('c2000046-0000-4000-8000-000000000005', 'approvedBy', 'Approved by', 'REFERENCE', 80),
    ('c2000046-0000-4000-8000-000000000006', 'rejectionReason', 'Rejection reason', 'TEXT', 90),
    ('c2000046-0000-4000-8000-000000000007', 'notes', 'Note for approver', 'TEXT', 100),
    ('c2000046-0000-4000-8000-000000000008', 'createdAt', 'Created', 'DATETIME', 900)
) AS v(id, code, label, field_type, sort_order)
WHERE NOT EXISTS (
    SELECT 1 FROM sys_field f
    WHERE f.table_id = 'c1000001-0000-4000-8000-00000000000d'::uuid AND f.code = v.code AND f.organization_id IS NULL);

-- Only the week identifies a timesheet row; status and resource can be hidden like any other column.
UPDATE sys_field
SET mandatory = FALSE
WHERE table_id = 'c1000001-0000-4000-8000-00000000000d'::uuid
  AND organization_id IS NULL
  AND code IN ('status', 'resourceId');

UPDATE sys_field
SET filterable = TRUE
WHERE table_id = 'c1000001-0000-4000-8000-00000000000d'::uuid
  AND organization_id IS NULL
  AND code IN ('status', 'weekStartDate', 'resourceId', 'totalHours', 'entrySource');

UPDATE sys_list_layout
SET layout_json = '{"columns":[{"field":"weekStartDate","label":"Week"},{"field":"resourceId","label":"Resource"},{"field":"status","label":"Status"},{"field":"totalHours","label":"Hours"},{"field":"entrySource","label":"Entered"}],"defaultSort":{"field":"weekStartDate","direction":"DESC"}}'::jsonb
WHERE id = 'c3000002-0000-4000-8000-00000000000d'
  AND organization_id IS NULL;
