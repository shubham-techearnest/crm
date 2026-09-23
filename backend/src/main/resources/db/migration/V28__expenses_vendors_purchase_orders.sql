-- Batch 19: Expenses, Vendors, Purchase Orders (draft)

CREATE TABLE expenses (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    region_id UUID NOT NULL REFERENCES regions(id),
    resource_id UUID REFERENCES resources(id),
    project_id UUID REFERENCES projects(id),
    purchase_order_id UUID,
    category VARCHAR(64) NOT NULL,
    description VARCHAR(500),
    amount NUMERIC(18, 2) NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    expense_date DATE NOT NULL,
    billable BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    approval_request_id UUID,
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    rejected_at TIMESTAMPTZ,
    rejected_by UUID,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT expenses_status_chk CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'
    )),
    CONSTRAINT expenses_amount_chk CHECK (amount > 0)
);

CREATE INDEX idx_expenses_org_status ON expenses (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_resource ON expenses (resource_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_project ON expenses (project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_date ON expenses (organization_id, expense_date) WHERE deleted_at IS NULL;

CREATE TABLE vendors (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    region_id UUID NOT NULL REFERENCES regions(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(64),
    tax_number VARCHAR(64),
    account_id UUID REFERENCES accounts(id),
    payment_terms_days INT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT vendors_status_chk CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX idx_vendors_org_status ON vendors (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_name ON vendors (organization_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    region_id UUID NOT NULL REFERENCES regions(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    project_id UUID REFERENCES projects(id),
    requester_id UUID,
    po_number VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total NUMERIC(18, 2) NOT NULL DEFAULT 0,
    needed_by DATE,
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT purchase_orders_status_chk CHECK (status IN (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
        'SENT', 'PARTIAL_RECEIVED', 'CLOSED', 'CANCELLED'
    ))
);

CREATE UNIQUE INDEX uq_purchase_orders_org_number
    ON purchase_orders (organization_id, po_number)
    WHERE deleted_at IS NULL AND po_number IS NOT NULL;

CREATE INDEX idx_purchase_orders_org_status ON purchase_orders (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders (vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_project ON purchase_orders (project_id) WHERE deleted_at IS NULL;

CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    line_no INT NOT NULL,
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_rate_id UUID REFERENCES tax_rates(id),
    tax_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    received_qty NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_po_item_line_no UNIQUE (purchase_order_id, line_no),
    CONSTRAINT po_items_qty_chk CHECK (quantity > 0)
);

CREATE INDEX idx_po_items_po ON purchase_order_items (purchase_order_id) WHERE deleted_at IS NULL;

ALTER TABLE expenses
    ADD CONSTRAINT fk_expenses_purchase_order
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);

-- Permissions (extend V14 stubs)
INSERT INTO permissions (code, module, description) VALUES
    ('EXPENSE_UPDATE', 'expense', 'Update draft expenses'),
    ('EXPENSE_DELETE', 'expense', 'Soft-delete expenses'),
    ('VENDOR_VIEW', 'procurement', 'View vendors'),
    ('VENDOR_MANAGE', 'procurement', 'Create and update vendors'),
    ('PO_UPDATE', 'procurement', 'Update purchase orders'),
    ('PO_DELETE', 'procurement', 'Soft-delete purchase orders')
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
    'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_UPDATE', 'EXPENSE_DELETE', 'EXPENSE_APPROVE',
    'VENDOR_VIEW', 'VENDOR_MANAGE',
    'PO_VIEW', 'PO_CREATE', 'PO_UPDATE', 'PO_DELETE', 'PO_APPROVE'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000008', p.id
FROM permissions p
WHERE p.code IN (
    'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_UPDATE', 'EXPENSE_DELETE', 'EXPENSE_APPROVE',
    'VENDOR_VIEW', 'VENDOR_MANAGE',
    'PO_VIEW', 'PO_CREATE', 'PO_UPDATE', 'PO_DELETE', 'PO_APPROVE'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000006', p.id
FROM permissions p
WHERE p.code IN ('EXPENSE_VIEW', 'EXPENSE_APPROVE', 'PO_VIEW', 'VENDOR_VIEW')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000009', p.id
FROM permissions p
WHERE p.code IN ('EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_UPDATE', 'EXPENSE_DELETE')
ON CONFLICT DO NOTHING;

INSERT INTO sys_table (id, organization_id, code, label, plural, module_group, active, is_system)
VALUES
    ('c1000001-0000-4000-8000-000000000053', NULL, 'expense', 'Expense', 'Expenses', 'Expenses', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000054', NULL, 'vendor', 'Vendor', 'Vendors', 'Procurement', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000055', NULL, 'purchase_order', 'Purchase Order', 'Purchase Orders', 'Procurement', TRUE, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO sys_table_acl (id, organization_id, role_id, table_id, can_create, can_read, can_update, can_delete)
SELECT
    gen_random_uuid(),
    '11111111-1111-4111-8111-111111111111',
    r.id,
    t.id,
    CASE
        WHEN r.code IN ('ORGANIZATION_ADMIN', 'FINANCE_USER') THEN TRUE
        WHEN r.code = 'EMPLOYEE' AND t.code = 'expense' THEN TRUE
        ELSE FALSE
    END,
    CASE
        WHEN r.code IN ('ORGANIZATION_ADMIN', 'FINANCE_USER', 'PROJECT_MANAGER', 'EMPLOYEE') THEN TRUE
        ELSE FALSE
    END,
    CASE
        WHEN r.code IN ('ORGANIZATION_ADMIN', 'FINANCE_USER') THEN TRUE
        WHEN r.code = 'EMPLOYEE' AND t.code = 'expense' THEN TRUE
        ELSE FALSE
    END,
    CASE
        WHEN r.code IN ('ORGANIZATION_ADMIN', 'FINANCE_USER') THEN TRUE
        WHEN r.code = 'EMPLOYEE' AND t.code = 'expense' THEN TRUE
        ELSE FALSE
    END
FROM roles r
CROSS JOIN sys_table t
WHERE r.organization_id = '11111111-1111-4111-8111-111111111111'
  AND r.code IN ('ORGANIZATION_ADMIN', 'FINANCE_USER', 'PROJECT_MANAGER', 'EMPLOYEE')
  AND t.id IN (
    'c1000001-0000-4000-8000-000000000053',
    'c1000001-0000-4000-8000-000000000054',
    'c1000001-0000-4000-8000-000000000055'
  )
  AND NOT EXISTS (
      SELECT 1 FROM sys_table_acl a
      WHERE a.organization_id = '11111111-1111-4111-8111-111111111111'
        AND a.role_id = r.id
        AND a.table_id = t.id
  );
