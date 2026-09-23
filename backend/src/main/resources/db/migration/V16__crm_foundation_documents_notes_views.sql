-- V2 Step 0 / 0b: CRM platform foundation (notes, saved views, audit region)

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions (id);

CREATE INDEX IF NOT EXISTS audit_logs_region_idx ON audit_logs (organization_id, region_id, created_at);

CREATE TABLE notes (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    entity_type       varchar(32) NOT NULL,
    entity_id         uuid NOT NULL,
    body              text NOT NULL,
    created_by        uuid NOT NULL REFERENCES users (id),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    deleted_at        timestamptz,
    CONSTRAINT notes_entity_type_chk CHECK (entity_type IN (
        'LEAD', 'ACCOUNT', 'CONTACT', 'DEAL', 'PROJECT', 'TASK', 'ACTIVITY', 'RESOURCE', 'TIMESHEET'
    ))
);

CREATE INDEX notes_entity_idx ON notes (organization_id, entity_type, entity_id)
    WHERE deleted_at IS NULL;
CREATE INDEX notes_org_created_idx ON notes (organization_id, created_at DESC);

CREATE TABLE saved_views (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    owner_id          uuid NOT NULL REFERENCES users (id),
    module            varchar(32) NOT NULL,
    name              varchar(120) NOT NULL,
    visibility        varchar(16) NOT NULL DEFAULT 'PRIVATE',
    filter_json       jsonb,
    columns_json      jsonb,
    sort_json         jsonb,
    is_default        boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    deleted_at        timestamptz,
    CONSTRAINT saved_views_visibility_chk CHECK (visibility IN ('PRIVATE', 'SHARED', 'PUBLIC')),
    CONSTRAINT saved_views_module_chk CHECK (module IN (
        'LEAD', 'ACCOUNT', 'CONTACT', 'DEAL', 'ACTIVITY', 'PROJECT', 'TASK',
        'RESOURCE', 'TIMESHEET', 'INVOICE', 'VENDOR', 'PURCHASE_ORDER', 'EXPENSE', 'CONTRACT'
    ))
);

CREATE UNIQUE INDEX saved_views_owner_module_name_uq
    ON saved_views (organization_id, owner_id, module, lower(name))
    WHERE deleted_at IS NULL;
CREATE INDEX saved_views_module_idx ON saved_views (organization_id, module, owner_id)
    WHERE deleted_at IS NULL;

INSERT INTO permissions (code, module, description) VALUES
    ('NOTE_VIEW', 'note', 'View notes'),
    ('NOTE_CREATE', 'note', 'Create notes'),
    ('NOTE_DELETE', 'note', 'Delete notes'),
    ('SAVED_VIEW_MANAGE', 'view', 'Manage saved list views')
ON CONFLICT (code) DO NOTHING;

-- Grant new foundation permissions to roles that already have document access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code IN ('NOTE_VIEW', 'NOTE_CREATE', 'NOTE_DELETE', 'SAVED_VIEW_MANAGE')
  AND r.code IN (
      'SUPER_ADMIN',
      'ORGANIZATION_ADMIN',
      'REGIONAL_ADMIN',
      'SALES_MANAGER',
      'SALES_EXECUTIVE',
      'PROJECT_MANAGER',
      'FINANCE_USER'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code IN ('NOTE_VIEW', 'SAVED_VIEW_MANAGE')
  AND r.code IN ('RESOURCE_MANAGER', 'EMPLOYEE', 'VIEWER')
ON CONFLICT DO NOTHING;
