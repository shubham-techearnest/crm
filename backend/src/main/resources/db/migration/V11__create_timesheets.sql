CREATE TABLE timesheets (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    uuid NOT NULL REFERENCES organizations (id),
    resource_id        uuid NOT NULL REFERENCES resources (id),
    region_id          uuid NOT NULL REFERENCES regions (id),
    week_start_date    date NOT NULL,
    status             varchar(32) NOT NULL,
    submitted_at       timestamptz,
    approved_at        timestamptz,
    approved_by        uuid REFERENCES users (id),
    rejection_reason   text,
    deleted_at         timestamptz,
    version            bigint NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    created_by         uuid,
    updated_by         uuid,
    CONSTRAINT timesheets_status_chk CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'))
);

CREATE UNIQUE INDEX timesheets_resource_week_uq
    ON timesheets (resource_id, week_start_date)
    WHERE deleted_at IS NULL;
CREATE INDEX timesheets_org_status_idx ON timesheets (organization_id, status);
CREATE INDEX timesheets_org_region_idx ON timesheets (organization_id, region_id);
CREATE INDEX timesheets_org_created_idx ON timesheets (organization_id, created_at);

CREATE TABLE time_entries (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    timesheet_id      uuid NOT NULL REFERENCES timesheets (id),
    project_id        uuid NOT NULL REFERENCES projects (id),
    task_id           uuid REFERENCES project_tasks (id),
    work_date         date NOT NULL,
    hours             numeric(8, 2) NOT NULL,
    description       varchar(500),
    billable          boolean NOT NULL DEFAULT true,
    billing_rate      numeric(18, 2),
    deleted_at        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT time_entries_hours_chk CHECK (hours > 0 AND hours <= 24)
);

CREATE INDEX time_entries_timesheet_idx ON time_entries (timesheet_id, work_date);
CREATE INDEX time_entries_project_idx ON time_entries (project_id);
CREATE INDEX time_entries_org_idx ON time_entries (organization_id);
