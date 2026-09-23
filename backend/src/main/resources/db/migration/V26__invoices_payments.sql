-- Batch 17: Invoices, lines, sequences, payments

CREATE TABLE invoice_number_sequences (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    prefix VARCHAR(16) NOT NULL DEFAULT 'INV',
    next_value BIGINT NOT NULL DEFAULT 1,
    pad_width INT NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_invoice_seq_org_prefix UNIQUE (organization_id, prefix)
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    region_id UUID NOT NULL REFERENCES regions(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    project_id UUID REFERENCES projects(id),
    invoice_number VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    issue_date DATE,
    due_date DATE,
    subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total NUMERIC(18, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(18, 2) NOT NULL DEFAULT 0,
    balance_due NUMERIC(18, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT invoices_status_chk CHECK (status IN (
        'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'OVERDUE'
    ))
);

CREATE UNIQUE INDEX uq_invoices_org_number
    ON invoices (organization_id, invoice_number)
    WHERE deleted_at IS NULL AND invoice_number IS NOT NULL;

CREATE INDEX idx_invoices_org_status ON invoices (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_account ON invoices (account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_due ON invoices (organization_id, due_date) WHERE deleted_at IS NULL;

CREATE TABLE invoice_lines (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    line_no INT NOT NULL,
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_rate_id UUID REFERENCES tax_rates(id),
    tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    project_id UUID REFERENCES projects(id),
    time_entry_id UUID REFERENCES time_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_invoice_line_no UNIQUE (invoice_id, line_no)
);

CREATE UNIQUE INDEX uq_invoice_lines_time_entry
    ON invoice_lines (time_entry_id)
    WHERE time_entry_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines (invoice_id) WHERE deleted_at IS NULL;

CREATE TABLE invoice_payments (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    amount NUMERIC(18, 2) NOT NULL,
    paid_at DATE NOT NULL,
    method VARCHAR(32),
    reference VARCHAR(128),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT invoice_payments_amount_chk CHECK (amount > 0)
);

CREATE INDEX idx_invoice_payments_invoice ON invoice_payments (invoice_id) WHERE deleted_at IS NULL;

-- Extend finance role grants if needed (perms already in V14)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000008', p.id
FROM permissions p
WHERE p.code IN ('INVOICE_VIEW', 'INVOICE_CREATE', 'INVOICE_UPDATE', 'INVOICE_DELETE', 'PAYMENT_MANAGE')
ON CONFLICT DO NOTHING;
