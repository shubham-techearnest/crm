-- Soft-delete-friendly unique keys for regions and projects (parity with users/skills/timesheets).

ALTER TABLE regions DROP CONSTRAINT IF EXISTS regions_org_code_uq;
CREATE UNIQUE INDEX regions_org_code_uq
    ON regions (organization_id, code)
    WHERE deleted_at IS NULL;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_org_code_uq;
CREATE UNIQUE INDEX projects_org_code_uq
    ON projects (organization_id, project_code)
    WHERE deleted_at IS NULL;
