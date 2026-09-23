-- Batch 12: complete table ACL seed + Field ACL (FLS)

-- Missing live modules for US-S10-004
INSERT INTO sys_table_acl (id, organization_id, role_id, table_id, can_create, can_read, can_update, can_delete)
SELECT
    gen_random_uuid(),
    '11111111-1111-4111-8111-111111111111',
    r.id,
    t.id,
    CASE
        WHEN r.code = 'ORGANIZATION_ADMIN' THEN TRUE
        WHEN r.code IN ('PROJECT_MANAGER','RESOURCE_MANAGER') AND t.code IN ('project_task','milestone','resource','allocation','skill') THEN TRUE
        WHEN r.code = 'EMPLOYEE' AND t.code IN ('project_task','skill') THEN FALSE
        ELSE FALSE
    END,
    CASE
        WHEN r.code IN ('ORGANIZATION_ADMIN','VIEWER','REGIONAL_ADMIN','PROJECT_MANAGER','RESOURCE_MANAGER','EMPLOYEE','SALES_MANAGER','SALES_EXECUTIVE') THEN TRUE
        ELSE FALSE
    END,
    CASE
        WHEN r.code = 'ORGANIZATION_ADMIN' THEN TRUE
        WHEN r.code IN ('PROJECT_MANAGER','RESOURCE_MANAGER') AND t.code IN ('project_task','milestone','resource','allocation','skill') THEN TRUE
        WHEN r.code = 'EMPLOYEE' AND t.code = 'project_task' THEN TRUE
        ELSE FALSE
    END,
    CASE
        WHEN r.code = 'ORGANIZATION_ADMIN' THEN TRUE
        WHEN r.code IN ('PROJECT_MANAGER','RESOURCE_MANAGER') AND t.code IN ('project_task','milestone','resource','allocation') THEN TRUE
        ELSE FALSE
    END
FROM roles r
CROSS JOIN sys_table t
WHERE r.organization_id = '11111111-1111-4111-8111-111111111111'
  AND r.code IN (
      'ORGANIZATION_ADMIN','VIEWER','SALES_EXECUTIVE','SALES_MANAGER',
      'EMPLOYEE','REGIONAL_ADMIN','PROJECT_MANAGER','RESOURCE_MANAGER'
  )
  AND t.organization_id IS NULL
  AND t.code IN ('project_task','milestone','resource','allocation','skill','department','organization')
  AND NOT EXISTS (
      SELECT 1 FROM sys_table_acl a
      WHERE a.organization_id = '11111111-1111-4111-8111-111111111111'
        AND a.role_id = r.id
        AND a.table_id = t.id
  );

-- Tighten VIEWER: ensure read-only on all tables (re-assert delete/create false)
UPDATE sys_table_acl a
SET can_create = FALSE, can_update = FALSE, can_delete = FALSE, updated_at = NOW()
FROM roles r
WHERE a.role_id = r.id
  AND r.code = 'VIEWER'
  AND a.organization_id = '11111111-1111-4111-8111-111111111111';

-- Field ACL
CREATE TABLE sys_field_acl (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    field_id UUID NOT NULL REFERENCES sys_field(id),
    access_level VARCHAR(16) NOT NULL DEFAULT 'WRITE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    CONSTRAINT sys_field_acl_level_chk CHECK (access_level IN ('HIDDEN', 'READ', 'WRITE')),
    CONSTRAINT uq_sys_field_acl UNIQUE (organization_id, role_id, field_id)
);

CREATE INDEX idx_sys_field_acl_role ON sys_field_acl (role_id);
CREATE INDEX idx_sys_field_acl_field ON sys_field_acl (field_id);

INSERT INTO permissions (code, module, description) VALUES
    ('FIELD_ACL_VIEW', 'metadata', 'View field ACL matrix'),
    ('FIELD_ACL_MANAGE', 'metadata', 'Manage field ACL matrix');

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000002', id FROM permissions
WHERE code IN ('FIELD_ACL_VIEW', 'FIELD_ACL_MANAGE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000001', id FROM permissions
WHERE code IN ('FIELD_ACL_VIEW', 'FIELD_ACL_MANAGE');

-- Ensure resource/allocation rate fields exist in dictionary
INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, active, is_system, sort_order)
SELECT v.id, NULL, v.table_id, v.code, v.label, v.help, 'NUMBER', FALSE, TRUE, TRUE, v.sort
FROM (VALUES
    ('c2000001-0000-4000-8000-0000000000b1'::uuid, 'c1000001-0000-4000-8000-00000000000a'::uuid, 'costRate', 'Cost rate', 'Internal cost rate', 40),
    ('c2000001-0000-4000-8000-0000000000b2'::uuid, 'c1000001-0000-4000-8000-00000000000a'::uuid, 'billingRate', 'Billing rate', 'Client billing rate', 50),
    ('c2000001-0000-4000-8000-0000000000b3'::uuid, 'c1000001-0000-4000-8000-00000000000b'::uuid, 'costRate', 'Cost rate', 'Allocation cost rate', 40),
    ('c2000001-0000-4000-8000-0000000000b4'::uuid, 'c1000001-0000-4000-8000-00000000000b'::uuid, 'billingRate', 'Billing rate', 'Allocation billing rate', 50),
    ('c2000001-0000-4000-8000-0000000000b5'::uuid, 'c1000001-0000-4000-8000-00000000000b'::uuid, 'margin', 'Margin', 'Derived margin (billing - cost)', 60)
) AS v(id, table_id, code, label, help, sort)
WHERE NOT EXISTS (
    SELECT 1 FROM sys_field f
    WHERE f.table_id = v.table_id AND f.code = v.code AND f.organization_id IS NULL
);

-- Seed FLS: Sales roles HIDDEN on rates; Finance WRITE; Org Admin WRITE; others READ if RATE_VIEW-like
INSERT INTO sys_field_acl (id, organization_id, role_id, field_id, access_level)
SELECT
    gen_random_uuid(),
    '11111111-1111-4111-8111-111111111111',
    r.id,
    f.id,
    CASE
        WHEN r.code = 'ORGANIZATION_ADMIN' THEN 'WRITE'
        WHEN r.code = 'FINANCE_USER' THEN 'WRITE'
        WHEN r.code IN ('RESOURCE_MANAGER','PROJECT_MANAGER') THEN 'READ'
        WHEN r.code IN ('SALES_EXECUTIVE','SALES_MANAGER','VIEWER','EMPLOYEE') THEN 'HIDDEN'
        ELSE 'HIDDEN'
    END
FROM roles r
CROSS JOIN sys_field f
WHERE r.organization_id = '11111111-1111-4111-8111-111111111111'
  AND f.organization_id IS NULL
  AND f.code IN ('costRate', 'billingRate', 'margin')
  AND f.table_id IN (
      'c1000001-0000-4000-8000-00000000000a',
      'c1000001-0000-4000-8000-00000000000b'
  );
