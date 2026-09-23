-- Batch 16: Approvalperms, outbox harden, workflow skeleton, tax rates

-- ——— Permissions ———
INSERT INTO permissions (code, module, description) VALUES
    ('APPROVAL_VIEW', 'approval', 'View approval requests inbox'),
    ('APPROVAL_ACT', 'approval', 'Approve or reject pending requests'),
    ('WORKFLOW_VIEW', 'workflow', 'View workflow definitions and runs'),
    ('WORKFLOW_MANAGE', 'workflow', 'Manage workflow definitions'),
    ('TAX_VIEW', 'finance', 'View tax rates'),
    ('TAX_MANAGE', 'finance', 'Create and update tax rates')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.id IN (
    '66666666-6666-4666-8666-000000000001',
    '66666666-6666-4666-8666-000000000002'
)
  AND p.code IN (
    'APPROVAL_VIEW', 'APPROVAL_ACT', 'APPROVAL_ADMIN',
    'WORKFLOW_VIEW', 'WORKFLOW_MANAGE',
    'TAX_VIEW', 'TAX_MANAGE'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.id IN (
    '66666666-6666-4666-8666-000000000006',
    '66666666-6666-4666-8666-000000000007'
)
  AND p.code IN ('APPROVAL_VIEW', 'APPROVAL_ACT')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.id = '66666666-6666-4666-8666-000000000008'
  AND p.code IN ('TAX_VIEW', 'TAX_MANAGE', 'APPROVAL_VIEW')
ON CONFLICT DO NOTHING;

-- ——— Outbox harden (domain_events from V13) ———
ALTER TABLE domain_events
    ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error TEXT,
    ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128),
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(64),
    ADD COLUMN IF NOT EXISTS entity_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_domain_events_idempotency
    ON domain_events (organization_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_chk;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_chk CHECK (action IN (
    'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'ASSIGN', 'CONVERT',
    'LOGIN', 'LOGOUT', 'EXECUTE'
));

-- ——— Workflow skeleton ———
CREATE TABLE workflow_definitions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workflow_def_org_code UNIQUE (organization_id, code)
);

CREATE INDEX idx_workflow_definitions_event
    ON workflow_definitions (organization_id, event_type)
    WHERE active = TRUE;

CREATE TABLE workflow_actions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
    action_order INT NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workflow_action_type_chk CHECK (action_type IN ('NOTIFY', 'NOOP')),
    CONSTRAINT uq_workflow_action_order UNIQUE (definition_id, action_order)
);

CREATE TABLE workflow_runs (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
    event_id UUID NOT NULL REFERENCES domain_events(id),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workflow_run_status_chk CHECK (
        status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED')
    ),
    CONSTRAINT uq_workflow_run_event_def UNIQUE (event_id, definition_id)
);

CREATE INDEX idx_workflow_runs_org ON workflow_runs (organization_id, created_at DESC);

-- ——— Tax rates (GST-ready) ———
CREATE TABLE tax_rates (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    rate_percent NUMERIC(8, 4) NOT NULL,
    jurisdiction VARCHAR(64),
    tax_type VARCHAR(16) NOT NULL DEFAULT 'OTHER',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT tax_rate_type_chk CHECK (tax_type IN ('CGST', 'SGST', 'IGST', 'OTHER')),
    CONSTRAINT uq_tax_rate_org_code UNIQUE (organization_id, code)
);

CREATE INDEX idx_tax_rates_org ON tax_rates (organization_id) WHERE deleted_at IS NULL;

INSERT INTO sys_table (id, organization_id, code, label, plural, module_group, active, is_system)
VALUES (
    'c1000001-0000-4000-8000-000000000050',
    NULL,
    'tax_rate',
    'Tax Rate',
    'Tax Rates',
    'Finance',
    TRUE,
    TRUE
) ON CONFLICT DO NOTHING;
