-- Project types drive which billing models apply. In-house projects are internal,
-- have no customer account and are never invoiced (NON_BILLABLE).
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_billing_chk;

ALTER TABLE projects
    ADD COLUMN project_type varchar(32) NOT NULL DEFAULT 'B2B',
    ADD COLUMN contract_reference varchar(128),
    ADD COLUMN contract_signed_date date,
    ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE projects
    ADD CONSTRAINT projects_type_chk CHECK (project_type IN ('IN_HOUSE', 'B2B', 'CONTRACT')),
    ADD CONSTRAINT projects_billing_chk CHECK (
        billing_type IN ('STAFF_AUGMENTATION', 'TIME_AND_MATERIAL', 'FIXED_MONTHLY', 'FIXED_BID', 'NON_BILLABLE')),
    ADD CONSTRAINT projects_account_chk CHECK (account_id IS NOT NULL OR project_type = 'IN_HOUSE');

CREATE INDEX IF NOT EXISTS idx_projects_type ON projects (organization_id, project_type) WHERE deleted_at IS NULL;
