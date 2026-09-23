-- Batch 13: default layouts for CRM/delivery; filterable flag on sys_field

ALTER TABLE sys_field ADD COLUMN IF NOT EXISTS filterable BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark known filterable fields (Lead + common CRM)
UPDATE sys_field SET filterable = TRUE
WHERE organization_id IS NULL
  AND (
    (table_id = 'c1000001-0000-4000-8000-000000000001' AND code IN (
      'status','source','priority','industry','regionId','ownerId','email','companyName',
      'firstName','lastName','estimatedValue','expectedCloseDate','createdAt'
    ))
    OR (table_id = 'c1000001-0000-4000-8000-000000000002' AND code IN (
      'firstName','lastName','email','accountId','status','regionId','ownerId','createdAt'
    ))
    OR (table_id = 'c1000001-0000-4000-8000-000000000003' AND code IN (
      'name','status','accountType','industry','regionId','ownerId','createdAt'
    ))
    OR (table_id = 'c1000001-0000-4000-8000-000000000004' AND code IN (
      'name','stage','value','accountId','ownerId','regionId','expectedCloseDate','createdAt'
    ))
    OR (table_id = 'c1000001-0000-4000-8000-000000000005' AND code IN (
      'subject','type','status','priority','dueDate','relatedEntityType','createdAt'
    ))
  );

-- Contact CREATE form
INSERT INTO sys_form_layout (id, organization_id, table_id, layout_key, status, layout_json, version, published_at)
VALUES (
    'c3000001-0000-4000-8000-000000000002',
    NULL,
    'c1000001-0000-4000-8000-000000000002',
    'CREATE',
    'PUBLISHED',
    '{
      "sections": [
        {"id":"primary","title":"Primary details","disclosure":"ALWAYS","fields":["accountId","firstName","lastName","email","status"]},
        {"id":"additional","title":"Additional details","disclosure":"MORE","fields":["phone","mobile","designation","department","linkedinUrl","notes"]}
      ]
    }'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO sys_list_layout (id, organization_id, table_id, role_id, status, layout_json, version, published_at)
VALUES (
    'c3000002-0000-4000-8000-000000000002',
    NULL,
    'c1000001-0000-4000-8000-000000000002',
    NULL,
    'PUBLISHED',
    '{"columns":[{"field":"firstName","label":"First name"},{"field":"lastName","label":"Last name"},{"field":"email","label":"Email"},{"field":"status","label":"Status"},{"field":"createdAt","label":"Created"}],"defaultSort":{"field":"createdAt","direction":"DESC"}}'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

-- Account CREATE form
INSERT INTO sys_form_layout (id, organization_id, table_id, layout_key, status, layout_json, version, published_at)
VALUES (
    'c3000001-0000-4000-8000-000000000003',
    NULL,
    'c1000001-0000-4000-8000-000000000003',
    'CREATE',
    'PUBLISHED',
    '{
      "sections": [
        {"id":"primary","title":"Primary details","disclosure":"ALWAYS","fields":["regionId","name","accountType","status"]},
        {"id":"additional","title":"Additional details","disclosure":"MORE","fields":["industry","website","email","phone","taxNumber","description"]}
      ]
    }'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO sys_list_layout (id, organization_id, table_id, role_id, status, layout_json, version, published_at)
VALUES (
    'c3000002-0000-4000-8000-000000000003',
    NULL,
    'c1000001-0000-4000-8000-000000000003',
    NULL,
    'PUBLISHED',
    '{"columns":[{"field":"name","label":"Name"},{"field":"accountType","label":"Type"},{"field":"status","label":"Status"},{"field":"industry","label":"Industry"},{"field":"createdAt","label":"Created"}],"defaultSort":{"field":"createdAt","direction":"DESC"}}'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

-- Deal CREATE form
INSERT INTO sys_form_layout (id, organization_id, table_id, layout_key, status, layout_json, version, published_at)
VALUES (
    'c3000001-0000-4000-8000-000000000004',
    NULL,
    'c1000001-0000-4000-8000-000000000004',
    'CREATE',
    'PUBLISHED',
    '{
      "sections": [
        {"id":"primary","title":"Primary details","disclosure":"ALWAYS","fields":["accountId","name","stage","value"]},
        {"id":"additional","title":"Additional details","disclosure":"MORE","fields":["contactId","probability","expectedCloseDate","source","competitor","description"]}
      ]
    }'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO sys_list_layout (id, organization_id, table_id, role_id, status, layout_json, version, published_at)
VALUES (
    'c3000002-0000-4000-8000-000000000004',
    NULL,
    'c1000001-0000-4000-8000-000000000004',
    NULL,
    'PUBLISHED',
    '{"columns":[{"field":"name","label":"Name"},{"field":"stage","label":"Stage"},{"field":"value","label":"Value"},{"field":"expectedCloseDate","label":"Close"},{"field":"createdAt","label":"Created"}],"defaultSort":{"field":"createdAt","direction":"DESC"}}'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

-- Activity CREATE form
INSERT INTO sys_form_layout (id, organization_id, table_id, layout_key, status, layout_json, version, published_at)
VALUES (
    'c3000001-0000-4000-8000-000000000005',
    NULL,
    'c1000001-0000-4000-8000-000000000005',
    'CREATE',
    'PUBLISHED',
    '{
      "sections": [
        {"id":"primary","title":"Primary details","disclosure":"ALWAYS","fields":["subject","type","status","relatedEntityType","relatedEntityId"]},
        {"id":"additional","title":"Additional details","disclosure":"MORE","fields":["priority","dueDate","assignedTo","description"]}
      ]
    }'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO sys_list_layout (id, organization_id, table_id, role_id, status, layout_json, version, published_at)
VALUES (
    'c3000002-0000-4000-8000-000000000005',
    NULL,
    'c1000001-0000-4000-8000-000000000005',
    NULL,
    'PUBLISHED',
    '{"columns":[{"field":"subject","label":"Subject"},{"field":"type","label":"Type"},{"field":"status","label":"Status"},{"field":"dueDate","label":"Due"},{"field":"createdAt","label":"Created"}],"defaultSort":{"field":"createdAt","direction":"DESC"}}'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

-- Project CREATE + list
INSERT INTO sys_form_layout (id, organization_id, table_id, layout_key, status, layout_json, version, published_at)
VALUES (
    'c3000001-0000-4000-8000-000000000007',
    NULL,
    'c1000001-0000-4000-8000-000000000007',
    'CREATE',
    'PUBLISHED',
    '{
      "sections": [
        {"id":"primary","title":"Primary details","disclosure":"ALWAYS","fields":["name","status","accountId"]},
        {"id":"additional","title":"Additional details","disclosure":"MORE","fields":[]}
      ]
    }'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO sys_list_layout (id, organization_id, table_id, role_id, status, layout_json, version, published_at)
VALUES (
    'c3000002-0000-4000-8000-000000000007',
    NULL,
    'c1000001-0000-4000-8000-000000000007',
    NULL,
    'PUBLISHED',
    '{"columns":[{"field":"name","label":"Name"},{"field":"status","label":"Status"},{"field":"accountId","label":"Account"}],"defaultSort":{"field":"name","direction":"ASC"}}'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

-- Resource CREATE + list
INSERT INTO sys_form_layout (id, organization_id, table_id, layout_key, status, layout_json, version, published_at)
VALUES (
    'c3000001-0000-4000-8000-00000000000a',
    NULL,
    'c1000001-0000-4000-8000-00000000000a',
    'CREATE',
    'PUBLISHED',
    '{
      "sections": [
        {"id":"primary","title":"Primary details","disclosure":"ALWAYS","fields":["costRate","billingRate"]},
        {"id":"additional","title":"Additional details","disclosure":"MORE","fields":[]}
      ]
    }'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO sys_list_layout (id, organization_id, table_id, role_id, status, layout_json, version, published_at)
VALUES (
    'c3000002-0000-4000-8000-00000000000a',
    NULL,
    'c1000001-0000-4000-8000-00000000000a',
    NULL,
    'PUBLISHED',
    '{"columns":[{"field":"costRate","label":"Cost rate"},{"field":"billingRate","label":"Billing rate"}],"defaultSort":{"field":"costRate","direction":"DESC"}}'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

-- Timesheet CREATE + list
INSERT INTO sys_form_layout (id, organization_id, table_id, layout_key, status, layout_json, version, published_at)
VALUES (
    'c3000001-0000-4000-8000-00000000000d',
    NULL,
    'c1000001-0000-4000-8000-00000000000d',
    'CREATE',
    'PUBLISHED',
    '{
      "sections": [
        {"id":"primary","title":"Primary details","disclosure":"ALWAYS","fields":["status","weekStartDate","resourceId"]},
        {"id":"additional","title":"Additional details","disclosure":"MORE","fields":[]}
      ]
    }'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO sys_list_layout (id, organization_id, table_id, role_id, status, layout_json, version, published_at)
VALUES (
    'c3000002-0000-4000-8000-00000000000d',
    NULL,
    'c1000001-0000-4000-8000-00000000000d',
    NULL,
    'PUBLISHED',
    '{"columns":[{"field":"status","label":"Status"},{"field":"weekStartDate","label":"Week start"},{"field":"resourceId","label":"Resource"}],"defaultSort":{"field":"weekStartDate","direction":"DESC"}}'::jsonb,
    1,
    NOW()
) ON CONFLICT DO NOTHING;
