-- Batch 11: personal list prefs, form policies, related lists, table ACL

CREATE TABLE sys_user_list_pref (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    table_code VARCHAR(64) NOT NULL,
    columns_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sys_user_list_pref UNIQUE (organization_id, user_id, table_code)
);

CREATE TABLE sys_form_policy (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    table_id UUID NOT NULL REFERENCES sys_table(id),
    layout_key VARCHAR(32) NOT NULL DEFAULT 'EDIT',
    name VARCHAR(128) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    policy_json JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_sys_form_policy_table ON sys_form_policy (table_id);
CREATE UNIQUE INDEX uq_sys_form_policy_published
    ON sys_form_policy (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'), table_id, layout_key, name)
    WHERE status = 'PUBLISHED';

CREATE TABLE sys_related_list_layout (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    parent_table_id UUID NOT NULL REFERENCES sys_table(id),
    child_table_code VARCHAR(64) NOT NULL,
    label VARCHAR(128) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    permission_code VARCHAR(64),
    columns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_sys_related_list_parent ON sys_related_list_layout (parent_table_id);
CREATE UNIQUE INDEX uq_sys_related_list_published
    ON sys_related_list_layout (
        COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'),
        parent_table_id,
        child_table_code
    )
    WHERE status = 'PUBLISHED';

CREATE TABLE sys_table_acl (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    table_id UUID NOT NULL REFERENCES sys_table(id),
    can_create BOOLEAN NOT NULL DEFAULT FALSE,
    can_read BOOLEAN NOT NULL DEFAULT FALSE,
    can_update BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    CONSTRAINT uq_sys_table_acl UNIQUE (organization_id, role_id, table_id)
);

CREATE INDEX idx_sys_table_acl_role ON sys_table_acl (role_id);
CREATE INDEX idx_sys_table_acl_table ON sys_table_acl (table_id);

INSERT INTO permissions (code, module, description) VALUES
    ('ACL_VIEW', 'metadata', 'View table ACL matrix'),
    ('ACL_MANAGE', 'metadata', 'Manage table ACL matrix');

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000002', id FROM permissions
WHERE code IN ('ACL_VIEW', 'ACL_MANAGE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000001', id FROM permissions
WHERE code IN ('ACL_VIEW', 'ACL_MANAGE');

-- Deal LOST → lostReason mandatory policy (system published)
INSERT INTO sys_form_policy (id, organization_id, table_id, layout_key, name, status, policy_json, active, version, published_at)
VALUES (
    'c4000001-0000-4000-8000-000000000001',
    NULL,
    'c1000001-0000-4000-8000-000000000004',
    'EDIT',
    'Lost reason required when LOST',
    'PUBLISHED',
    '{
      "when": { "field": "stage", "op": "EQ", "value": "LOST" },
      "then": [
        { "field": "lostReason", "visible": true, "mandatory": true, "readOnly": false }
      ]
    }'::jsonb,
    TRUE,
    1,
    NOW()
);

-- Account related lists (system published)
INSERT INTO sys_related_list_layout (
    id, organization_id, parent_table_id, child_table_code, label, sort_order,
    permission_code, columns_json, status, active, published_at
) VALUES
(
    'c5000001-0000-4000-8000-000000000001',
    NULL,
    'c1000001-0000-4000-8000-000000000003',
    'contact',
    'Contacts',
    10,
    'CONTACT_VIEW',
    '[{"field":"firstName","label":"First name"},{"field":"lastName","label":"Last name"},{"field":"email","label":"Email"}]'::jsonb,
    'PUBLISHED',
    TRUE,
    NOW()
),
(
    'c5000001-0000-4000-8000-000000000002',
    NULL,
    'c1000001-0000-4000-8000-000000000003',
    'deal',
    'Deals',
    20,
    'DEAL_VIEW',
    '[{"field":"name","label":"Name"},{"field":"stage","label":"Stage"},{"field":"value","label":"Value"}]'::jsonb,
    'PUBLISHED',
    TRUE,
    NOW()
),
(
    'c5000001-0000-4000-8000-000000000003',
    NULL,
    'c1000001-0000-4000-8000-000000000003',
    'activity',
    'Activities',
    30,
    'ACTIVITY_VIEW',
    '[{"field":"subject","label":"Subject"},{"field":"status","label":"Status"}]'::jsonb,
    'PUBLISHED',
    TRUE,
    NOW()
);

-- Seed table ACL for demo org from known role × CRM table matrix
-- ORG_ADMIN full; VIEWER read-only; SALES_EXEC lead/account/contact/deal CRUD-ish; EMPLOYEE read CRM
INSERT INTO sys_table_acl (id, organization_id, role_id, table_id, can_create, can_read, can_update, can_delete)
SELECT
    gen_random_uuid(),
    '11111111-1111-4111-8111-111111111111',
    r.id,
    t.id,
    CASE
        WHEN r.code = 'ORGANIZATION_ADMIN' THEN TRUE
        WHEN r.code = 'SALES_EXECUTIVE' AND t.code IN ('lead','contact','account','deal','activity') THEN TRUE
        WHEN r.code = 'SALES_MANAGER' AND t.code IN ('lead','contact','account','deal','activity') THEN TRUE
        ELSE FALSE
    END,
    CASE
        WHEN r.code IN ('ORGANIZATION_ADMIN','VIEWER','SALES_EXECUTIVE','SALES_MANAGER','EMPLOYEE','REGIONAL_ADMIN') THEN TRUE
        ELSE FALSE
    END,
    CASE
        WHEN r.code = 'ORGANIZATION_ADMIN' THEN TRUE
        WHEN r.code IN ('SALES_EXECUTIVE','SALES_MANAGER') AND t.code IN ('lead','contact','account','deal','activity') THEN TRUE
        ELSE FALSE
    END,
    CASE
        WHEN r.code = 'ORGANIZATION_ADMIN' THEN TRUE
        WHEN r.code = 'SALES_MANAGER' AND t.code IN ('lead','contact','account','deal','activity') THEN TRUE
        ELSE FALSE
    END
FROM roles r
CROSS JOIN sys_table t
WHERE r.organization_id = '11111111-1111-4111-8111-111111111111'
  AND r.code IN ('ORGANIZATION_ADMIN','VIEWER','SALES_EXECUTIVE','SALES_MANAGER','EMPLOYEE','REGIONAL_ADMIN')
  AND t.organization_id IS NULL
  AND t.code IN ('lead','contact','account','deal','activity','document','project','timesheet','user','role','region');
