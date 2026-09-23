-- US-S8-004: complete CRM field dictionary
-- US-S9-001/003: form + list layout tables + Lead published defaults

CREATE TABLE sys_form_layout (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    table_id UUID NOT NULL REFERENCES sys_table(id),
    layout_key VARCHAR(32) NOT NULL DEFAULT 'CREATE',
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    layout_json JSONB NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID
);

CREATE UNIQUE INDEX uq_sys_form_layout_published
    ON sys_form_layout (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'), table_id, layout_key)
    WHERE status = 'PUBLISHED';
CREATE INDEX idx_sys_form_layout_table ON sys_form_layout (table_id);

CREATE TABLE sys_list_layout (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    table_id UUID NOT NULL REFERENCES sys_table(id),
    role_id UUID,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    layout_json JSONB NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID
);

CREATE UNIQUE INDEX uq_sys_list_layout_published
    ON sys_list_layout (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'), table_id, COALESCE(role_id, '00000000-0000-0000-0000-000000000000'))
    WHERE status = 'PUBLISHED';
CREATE INDEX idx_sys_list_layout_table ON sys_list_layout (table_id);

-- Helper: insert field if missing (system seed)
-- Lead fields
INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, reference_table_code, active, is_system, sort_order)
SELECT v.id, NULL, 'c1000001-0000-4000-8000-000000000001', v.code, v.label, v.help, v.ftype, v.mand, v.ref, TRUE, TRUE, v.sort
FROM (VALUES
    ('c2000001-0000-4000-8000-000000000101'::uuid, 'regionId', 'Region', NULL, 'REFERENCE', TRUE, 'region', 5),
    ('c2000001-0000-4000-8000-000000000102'::uuid, 'email', 'Email', NULL, 'STRING', FALSE, NULL, 45),
    ('c2000001-0000-4000-8000-000000000103'::uuid, 'phone', 'Phone', NULL, 'STRING', FALSE, NULL, 55),
    ('c2000001-0000-4000-8000-000000000104'::uuid, 'website', 'Website', NULL, 'STRING', FALSE, NULL, 60),
    ('c2000001-0000-4000-8000-000000000105'::uuid, 'source', 'Source', NULL, 'STRING', FALSE, NULL, 65),
    ('c2000001-0000-4000-8000-000000000106'::uuid, 'priority', 'Priority', NULL, 'ENUM', FALSE, NULL, 70),
    ('c2000001-0000-4000-8000-000000000107'::uuid, 'industry', 'Industry', NULL, 'STRING', FALSE, NULL, 75),
    ('c2000001-0000-4000-8000-000000000108'::uuid, 'designation', 'Designation', NULL, 'STRING', FALSE, NULL, 80),
    ('c2000001-0000-4000-8000-000000000109'::uuid, 'estimatedValue', 'Estimated value', NULL, 'NUMBER', FALSE, NULL, 85),
    ('c2000001-0000-4000-8000-00000000010a'::uuid, 'expectedCloseDate', 'Expected close', NULL, 'DATE', FALSE, NULL, 90),
    ('c2000001-0000-4000-8000-00000000010b'::uuid, 'description', 'Description', NULL, 'TEXT', FALSE, NULL, 95),
    ('c2000001-0000-4000-8000-00000000010c'::uuid, 'convertedAccountId', 'Converted account', NULL, 'REFERENCE', FALSE, 'account', 200),
    ('c2000001-0000-4000-8000-00000000010d'::uuid, 'convertedContactId', 'Converted contact', NULL, 'REFERENCE', FALSE, 'contact', 210),
    ('c2000001-0000-4000-8000-00000000010e'::uuid, 'convertedDealId', 'Converted deal', NULL, 'REFERENCE', FALSE, 'deal', 220),
    ('c2000001-0000-4000-8000-00000000010f'::uuid, 'convertedAt', 'Converted at', NULL, 'DATETIME', FALSE, NULL, 230),
    ('c2000001-0000-4000-8000-000000000110'::uuid, 'createdAt', 'Created', NULL, 'DATETIME', FALSE, NULL, 900),
    ('c2000001-0000-4000-8000-000000000111'::uuid, 'updatedAt', 'Updated', NULL, 'DATETIME', FALSE, NULL, 910)
) AS v(id, code, label, help, ftype, mand, ref, sort)
WHERE NOT EXISTS (
    SELECT 1 FROM sys_field f
    WHERE f.table_id = 'c1000001-0000-4000-8000-000000000001' AND f.code = v.code AND f.organization_id IS NULL
);

UPDATE sys_field SET reference_table_code = 'user'
WHERE table_id = 'c1000001-0000-4000-8000-000000000001' AND code = 'ownerId' AND organization_id IS NULL;

-- Contact fields
INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, reference_table_code, active, is_system, sort_order)
SELECT v.id, NULL, 'c1000001-0000-4000-8000-000000000002', v.code, v.label, NULL, v.ftype, v.mand, v.ref, TRUE, TRUE, v.sort
FROM (VALUES
    ('c2000001-0000-4000-8000-000000000201'::uuid, 'regionId', 'Region', 'REFERENCE', TRUE, 'region', 5),
    ('c2000001-0000-4000-8000-000000000202'::uuid, 'ownerId', 'Owner', 'REFERENCE', TRUE, 'user', 8),
    ('c2000001-0000-4000-8000-000000000203'::uuid, 'phone', 'Phone', 'STRING', FALSE, NULL, 50),
    ('c2000001-0000-4000-8000-000000000204'::uuid, 'mobile', 'Mobile', 'STRING', FALSE, NULL, 55),
    ('c2000001-0000-4000-8000-000000000205'::uuid, 'designation', 'Designation', 'STRING', FALSE, NULL, 60),
    ('c2000001-0000-4000-8000-000000000206'::uuid, 'department', 'Department', 'STRING', FALSE, NULL, 65),
    ('c2000001-0000-4000-8000-000000000207'::uuid, 'linkedinUrl', 'LinkedIn URL', 'STRING', FALSE, NULL, 70),
    ('c2000001-0000-4000-8000-000000000208'::uuid, 'status', 'Status', 'ENUM', TRUE, NULL, 75),
    ('c2000001-0000-4000-8000-000000000209'::uuid, 'notes', 'Notes', 'TEXT', FALSE, NULL, 80),
    ('c2000001-0000-4000-8000-00000000020a'::uuid, 'createdAt', 'Created', 'DATETIME', FALSE, NULL, 900)
) AS v(id, code, label, ftype, mand, ref, sort)
WHERE NOT EXISTS (
    SELECT 1 FROM sys_field f
    WHERE f.table_id = 'c1000001-0000-4000-8000-000000000002' AND f.code = v.code AND f.organization_id IS NULL
);

UPDATE sys_field SET reference_table_code = 'account'
WHERE table_id = 'c1000001-0000-4000-8000-000000000002' AND code = 'accountId' AND organization_id IS NULL;

-- Account fields
INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, reference_table_code, active, is_system, sort_order)
SELECT v.id, NULL, 'c1000001-0000-4000-8000-000000000003', v.code, v.label, NULL, v.ftype, v.mand, v.ref, TRUE, TRUE, v.sort
FROM (VALUES
    ('c2000001-0000-4000-8000-000000000301'::uuid, 'regionId', 'Region', 'REFERENCE', TRUE, 'region', 5),
    ('c2000001-0000-4000-8000-000000000302'::uuid, 'ownerId', 'Owner', 'REFERENCE', TRUE, 'user', 8),
    ('c2000001-0000-4000-8000-000000000303'::uuid, 'industry', 'Industry', 'STRING', FALSE, NULL, 40),
    ('c2000001-0000-4000-8000-000000000304'::uuid, 'website', 'Website', 'STRING', FALSE, NULL, 45),
    ('c2000001-0000-4000-8000-000000000305'::uuid, 'email', 'Email', 'STRING', FALSE, NULL, 50),
    ('c2000001-0000-4000-8000-000000000306'::uuid, 'phone', 'Phone', 'STRING', FALSE, NULL, 55),
    ('c2000001-0000-4000-8000-000000000307'::uuid, 'billingAddress', 'Billing address', 'TEXT', FALSE, NULL, 60),
    ('c2000001-0000-4000-8000-000000000308'::uuid, 'shippingAddress', 'Shipping address', 'TEXT', FALSE, NULL, 65),
    ('c2000001-0000-4000-8000-000000000309'::uuid, 'taxNumber', 'Tax number', 'STRING', FALSE, NULL, 70),
    ('c2000001-0000-4000-8000-00000000030a'::uuid, 'description', 'Description', 'TEXT', FALSE, NULL, 80),
    ('c2000001-0000-4000-8000-00000000030b'::uuid, 'createdAt', 'Created', 'DATETIME', FALSE, NULL, 900)
) AS v(id, code, label, ftype, mand, ref, sort)
WHERE NOT EXISTS (
    SELECT 1 FROM sys_field f
    WHERE f.table_id = 'c1000001-0000-4000-8000-000000000003' AND f.code = v.code AND f.organization_id IS NULL
);

-- Deal fields
INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, reference_table_code, active, is_system, sort_order)
SELECT v.id, NULL, 'c1000001-0000-4000-8000-000000000004', v.code, v.label, NULL, v.ftype, v.mand, v.ref, TRUE, TRUE, v.sort
FROM (VALUES
    ('c2000001-0000-4000-8000-000000000401'::uuid, 'regionId', 'Region', 'REFERENCE', TRUE, 'region', 5),
    ('c2000001-0000-4000-8000-000000000402'::uuid, 'accountId', 'Account', 'REFERENCE', TRUE, 'account', 8),
    ('c2000001-0000-4000-8000-000000000403'::uuid, 'contactId', 'Contact', 'REFERENCE', FALSE, 'contact', 12),
    ('c2000001-0000-4000-8000-000000000404'::uuid, 'ownerId', 'Owner', 'REFERENCE', TRUE, 'user', 15),
    ('c2000001-0000-4000-8000-000000000405'::uuid, 'leadId', 'Lead', 'REFERENCE', FALSE, 'lead', 18),
    ('c2000001-0000-4000-8000-000000000406'::uuid, 'probability', 'Probability', 'NUMBER', TRUE, NULL, 35),
    ('c2000001-0000-4000-8000-000000000407'::uuid, 'expectedCloseDate', 'Expected close', 'DATE', FALSE, NULL, 40),
    ('c2000001-0000-4000-8000-000000000408'::uuid, 'source', 'Source', 'STRING', FALSE, NULL, 45),
    ('c2000001-0000-4000-8000-000000000409'::uuid, 'description', 'Description', 'TEXT', FALSE, NULL, 50),
    ('c2000001-0000-4000-8000-00000000040a'::uuid, 'competitor', 'Competitor', 'STRING', FALSE, NULL, 55),
    ('c2000001-0000-4000-8000-00000000040b'::uuid, 'wonAt', 'Won at', 'DATETIME', FALSE, NULL, 60),
    ('c2000001-0000-4000-8000-00000000040c'::uuid, 'lostAt', 'Lost at', 'DATETIME', FALSE, NULL, 65),
    ('c2000001-0000-4000-8000-00000000040d'::uuid, 'lostReason', 'Lost reason', 'STRING', FALSE, NULL, 70),
    ('c2000001-0000-4000-8000-00000000040e'::uuid, 'createdAt', 'Created', 'DATETIME', FALSE, NULL, 900)
) AS v(id, code, label, ftype, mand, ref, sort)
WHERE NOT EXISTS (
    SELECT 1 FROM sys_field f
    WHERE f.table_id = 'c1000001-0000-4000-8000-000000000004' AND f.code = v.code AND f.organization_id IS NULL
);

-- Activity fields
INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, reference_table_code, active, is_system, sort_order)
SELECT v.id, NULL, 'c1000001-0000-4000-8000-000000000005', v.code, v.label, NULL, v.ftype, v.mand, v.ref, TRUE, TRUE, v.sort
FROM (VALUES
    ('c2000001-0000-4000-8000-000000000501'::uuid, 'regionId', 'Region', 'REFERENCE', FALSE, 'region', 5),
    ('c2000001-0000-4000-8000-000000000502'::uuid, 'description', 'Description', 'TEXT', FALSE, NULL, 35),
    ('c2000001-0000-4000-8000-000000000503'::uuid, 'priority', 'Priority', 'ENUM', FALSE, NULL, 40),
    ('c2000001-0000-4000-8000-000000000504'::uuid, 'dueDate', 'Due date', 'DATETIME', FALSE, NULL, 45),
    ('c2000001-0000-4000-8000-000000000505'::uuid, 'assignedTo', 'Assignee', 'REFERENCE', FALSE, 'user', 50),
    ('c2000001-0000-4000-8000-000000000506'::uuid, 'relatedEntityType', 'Related type', 'ENUM', TRUE, NULL, 55),
    ('c2000001-0000-4000-8000-000000000507'::uuid, 'relatedEntityId', 'Related record', 'REFERENCE', TRUE, NULL, 60),
    ('c2000001-0000-4000-8000-000000000508'::uuid, 'completedAt', 'Completed at', 'DATETIME', FALSE, NULL, 70),
    ('c2000001-0000-4000-8000-000000000509'::uuid, 'createdAt', 'Created', 'DATETIME', FALSE, NULL, 900)
) AS v(id, code, label, ftype, mand, ref, sort)
WHERE NOT EXISTS (
    SELECT 1 FROM sys_field f
    WHERE f.table_id = 'c1000001-0000-4000-8000-000000000005' AND f.code = v.code AND f.organization_id IS NULL
);

-- Published Lead CREATE form layout (matches current Modules UI)
INSERT INTO sys_form_layout (id, organization_id, table_id, layout_key, status, layout_json, version, published_at)
VALUES (
    'c3000001-0000-4000-8000-000000000001',
    NULL,
    'c1000001-0000-4000-8000-000000000001',
    'CREATE',
    'PUBLISHED',
    '{
      "sections": [
        {
          "id": "primary",
          "title": "Primary details",
          "disclosure": "ALWAYS",
          "fields": ["regionId", "firstName", "lastName", "companyName", "email", "status"]
        },
        {
          "id": "additional",
          "title": "Additional details",
          "disclosure": "MORE",
          "fields": ["phone", "source", "priority", "estimatedValue", "website", "industry", "designation", "expectedCloseDate", "description"]
        }
      ]
    }'::jsonb,
    1,
    NOW()
);

-- Published Lead list layout
INSERT INTO sys_list_layout (id, organization_id, table_id, role_id, status, layout_json, version, published_at)
VALUES (
    'c3000002-0000-4000-8000-000000000001',
    NULL,
    'c1000001-0000-4000-8000-000000000001',
    NULL,
    'PUBLISHED',
    '{
      "columns": [
        {"field": "companyName", "label": "Company", "width": 180},
        {"field": "firstName", "label": "First name", "width": 120},
        {"field": "lastName", "label": "Last name", "width": 120},
        {"field": "status", "label": "Status", "width": 110},
        {"field": "source", "label": "Source", "width": 120},
        {"field": "estimatedValue", "label": "Est. value", "width": 110},
        {"field": "createdAt", "label": "Created", "width": 140}
      ],
      "defaultSort": {"field": "createdAt", "direction": "DESC"}
    }'::jsonb,
    1,
    NOW()
);
