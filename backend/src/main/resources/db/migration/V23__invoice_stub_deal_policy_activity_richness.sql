-- Batch 14: invoice Studio stub; Deal WON close-date policy; activity meeting/call fields

-- ——— US-S11-006: Invoice stub registration (Studio only, no domain UI) ———
INSERT INTO sys_table (id, organization_id, code, label, plural, module_group, active, is_system)
VALUES (
    'c1000001-0000-4000-8000-000000000013',
    NULL,
    'invoice',
    'Invoice',
    'Invoices',
    'Finance',
    TRUE,
    TRUE
) ON CONFLICT DO NOTHING;

INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, reference_table_code, active, is_system, sort_order, filterable)
SELECT v.id, NULL, 'c1000001-0000-4000-8000-000000000013', v.code, v.label, v.help, v.ftype, v.mand, v.ref, TRUE, TRUE, v.sort, v.filt
FROM (VALUES
    ('c2000001-0000-4000-8000-000000000e01'::uuid, 'invoiceNumber', 'Invoice number', 'Human-readable invoice #', 'STRING', TRUE, NULL, 10, TRUE),
    ('c2000001-0000-4000-8000-000000000e02'::uuid, 'status', 'Status', 'DRAFT/SENT/PAID/VOID', 'ENUM', TRUE, NULL, 20, TRUE),
    ('c2000001-0000-4000-8000-000000000e03'::uuid, 'accountId', 'Account', 'Bill-to account', 'REFERENCE', TRUE, 'account', 30, TRUE),
    ('c2000001-0000-4000-8000-000000000e04'::uuid, 'total', 'Total', 'Invoice total', 'NUMBER', FALSE, NULL, 40, TRUE),
    ('c2000001-0000-4000-8000-000000000e05'::uuid, 'dueDate', 'Due date', NULL, 'DATE', FALSE, NULL, 50, TRUE),
    ('c2000001-0000-4000-8000-000000000e06'::uuid, 'currencyCode', 'Currency', NULL, 'STRING', FALSE, NULL, 60, FALSE),
    ('c2000001-0000-4000-8000-000000000e07'::uuid, 'notes', 'Notes', NULL, 'TEXT', FALSE, NULL, 70, FALSE)
) AS v(id, code, label, help, ftype, mand, ref, sort, filt)
WHERE NOT EXISTS (
    SELECT 1 FROM sys_field f
    WHERE f.table_id = 'c1000001-0000-4000-8000-000000000013' AND f.code = v.code AND f.organization_id IS NULL
);

INSERT INTO sys_form_layout (id, organization_id, table_id, layout_key, status, layout_json, version, published_at)
VALUES (
    'c3000001-0000-4000-8000-000000000013',
    NULL,
    'c1000001-0000-4000-8000-000000000013',
    'CREATE',
    'PUBLISHED',
    '{
      "sections": [
        {"id":"primary","title":"Primary details","disclosure":"ALWAYS","fields":["invoiceNumber","accountId","status","total"]},
        {"id":"additional","title":"Additional details","disclosure":"MORE","fields":["dueDate","currencyCode","notes"]}
      ]
    }'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO sys_list_layout (id, organization_id, table_id, role_id, status, layout_json, version, published_at)
VALUES (
    'c3000002-0000-4000-8000-000000000013',
    NULL,
    'c1000001-0000-4000-8000-000000000013',
    NULL,
    'PUBLISHED',
    '{"columns":[{"field":"invoiceNumber","label":"Number"},{"field":"status","label":"Status"},{"field":"accountId","label":"Account"},{"field":"total","label":"Total"},{"field":"dueDate","label":"Due"}],"defaultSort":{"field":"dueDate","direction":"DESC"}}'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

-- Demo org ACL for invoice stub (ORG_ADMIN full; VIEWER read)
INSERT INTO sys_table_acl (id, organization_id, role_id, table_id, can_create, can_read, can_update, can_delete)
SELECT
    gen_random_uuid(),
    '11111111-1111-4111-8111-111111111111',
    r.id,
    'c1000001-0000-4000-8000-000000000013'::uuid,
    CASE WHEN r.code = 'ORGANIZATION_ADMIN' THEN TRUE ELSE FALSE END,
    CASE WHEN r.code IN ('ORGANIZATION_ADMIN','VIEWER','SALES_MANAGER','REGIONAL_ADMIN') THEN TRUE ELSE FALSE END,
    CASE WHEN r.code = 'ORGANIZATION_ADMIN' THEN TRUE ELSE FALSE END,
    CASE WHEN r.code = 'ORGANIZATION_ADMIN' THEN TRUE ELSE FALSE END
FROM roles r
WHERE r.organization_id = '11111111-1111-4111-8111-111111111111'
  AND r.code IN ('ORGANIZATION_ADMIN','VIEWER','SALES_MANAGER','REGIONAL_ADMIN')
  AND NOT EXISTS (
      SELECT 1 FROM sys_table_acl a
      WHERE a.organization_id = '11111111-1111-4111-8111-111111111111'
        AND a.role_id = r.id
        AND a.table_id = 'c1000001-0000-4000-8000-000000000013'
  );

-- ——— US-S12-003: WON → expectedCloseDate mandatory ———
INSERT INTO sys_form_policy (id, organization_id, table_id, layout_key, name, status, policy_json, active, version, published_at)
VALUES (
    'c4000001-0000-4000-8000-000000000002',
    NULL,
    'c1000001-0000-4000-8000-000000000004',
    'EDIT',
    'Close date required when WON',
    'PUBLISHED',
    '{
      "when": { "field": "stage", "op": "EQ", "value": "WON" },
      "then": [
        { "field": "expectedCloseDate", "visible": true, "mandatory": true, "readOnly": false }
      ]
    }'::jsonb,
    TRUE,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

-- ——— US-S12-004 / 005: activity richness columns ———
ALTER TABLE activities ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS attendees TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS outcome VARCHAR(64);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS call_direction VARCHAR(16);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, reference_table_code, active, is_system, sort_order, filterable)
SELECT v.id, NULL, 'c1000001-0000-4000-8000-000000000005', v.code, v.label, v.help, v.ftype, FALSE, NULL, TRUE, TRUE, v.sort, v.filt
FROM (VALUES
    ('c2000001-0000-4000-8000-000000000511'::uuid, 'location', 'Location', 'Meeting location', 'STRING', 85, FALSE),
    ('c2000001-0000-4000-8000-000000000512'::uuid, 'attendees', 'Attendees', 'Comma-separated attendees', 'TEXT', 86, FALSE),
    ('c2000001-0000-4000-8000-000000000513'::uuid, 'outcome', 'Outcome', 'Meeting/call outcome', 'STRING', 87, TRUE),
    ('c2000001-0000-4000-8000-000000000514'::uuid, 'callDirection', 'Direction', 'INBOUND/OUTBOUND', 'ENUM', 88, TRUE),
    ('c2000001-0000-4000-8000-000000000515'::uuid, 'durationSeconds', 'Duration (sec)', 'Call duration', 'NUMBER', 89, FALSE)
) AS v(id, code, label, help, ftype, sort, filt)
WHERE NOT EXISTS (
    SELECT 1 FROM sys_field f
    WHERE f.table_id = 'c1000001-0000-4000-8000-000000000005' AND f.code = v.code AND f.organization_id IS NULL
);

UPDATE sys_form_layout
SET layout_json = '{
  "sections": [
    {"id":"primary","title":"Primary details","disclosure":"ALWAYS","fields":["subject","type","status","relatedEntityType","relatedEntityId"]},
    {"id":"additional","title":"Additional details","disclosure":"MORE","fields":["priority","dueDate","assignedTo","description","location","attendees","outcome","callDirection","durationSeconds"]}
  ]
}'::jsonb,
    updated_at = NOW()
WHERE id = 'c3000001-0000-4000-8000-000000000005'
  AND organization_id IS NULL;
