-- Batch 18: Credit notes + Contracts + expiry reminder log

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS amount_credited NUMERIC(18, 2) NOT NULL DEFAULT 0;

CREATE TABLE credit_notes (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    credit_number VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    amount NUMERIC(18, 2) NOT NULL,
    reason TEXT,
    issue_date DATE,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT credit_notes_status_chk CHECK (status IN ('DRAFT', 'ISSUED', 'APPLIED', 'VOID')),
    CONSTRAINT credit_notes_amount_chk CHECK (amount > 0)
);

CREATE UNIQUE INDEX uq_credit_notes_org_number
    ON credit_notes (organization_id, credit_number)
    WHERE deleted_at IS NULL AND credit_number IS NOT NULL;

CREATE INDEX idx_credit_notes_invoice ON credit_notes (invoice_id) WHERE deleted_at IS NULL;

CREATE TABLE contracts (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    region_id UUID NOT NULL REFERENCES regions(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    contract_number VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    value_amount NUMERIC(18, 2),
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    start_date DATE,
    end_date DATE,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    renewal_notice_days INT NOT NULL DEFAULT 30,
    terms TEXT,
    owner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT contracts_status_chk CHECK (status IN (
        'DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED'
    ))
);

CREATE INDEX idx_contracts_org_status ON contracts (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_account ON contracts (account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_end ON contracts (organization_id, end_date) WHERE deleted_at IS NULL;

CREATE TABLE contract_expiry_reminders (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    contract_id UUID NOT NULL REFERENCES contracts(id),
    remind_on DATE NOT NULL,
    notified_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contract_expiry_reminder UNIQUE (contract_id, remind_on)
);

INSERT INTO permissions (code, module, description) VALUES
    ('CREDIT_NOTE_MANAGE', 'invoice', 'Issue and apply credit notes')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.id IN (
    '66666666-6666-4666-8666-000000000001',
    '66666666-6666-4666-8666-000000000002',
    '66666666-6666-4666-8666-000000000008'
)
  AND p.code IN ('CREDIT_NOTE_MANAGE', 'CONTRACT_VIEW', 'CONTRACT_MANAGE')
ON CONFLICT DO NOTHING;

INSERT INTO sys_table (id, organization_id, code, label, plural, module_group, active, is_system)
VALUES
    ('c1000001-0000-4000-8000-000000000051', NULL, 'credit_note', 'Credit Note', 'Credit Notes', 'Finance', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000052', NULL, 'contract', 'Contract', 'Contracts', 'Contracts', TRUE, TRUE)
ON CONFLICT DO NOTHING;
