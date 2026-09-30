-- Self-service for resources that have no internal login (contractors, freelancers, consultants):
-- proxy timesheets, limited portal logins that expire with the engagement, secure timesheet links, timesheet import.

ALTER TABLE resources
    ADD COLUMN full_name varchar(200),
    ADD COLUMN email varchar(255),
    ADD COLUMN phone varchar(50),
    ADD COLUMN engagement_end_date date;

CREATE INDEX resources_org_email_idx ON resources (organization_id, lower(email)) WHERE deleted_at IS NULL;

ALTER TABLE users
    ADD COLUMN access_expires_at timestamptz;

ALTER TABLE timesheets
    ADD COLUMN entered_by uuid REFERENCES users (id),
    ADD COLUMN entry_source varchar(16) NOT NULL DEFAULT 'SELF',
    ADD CONSTRAINT timesheets_entry_source_chk CHECK (entry_source IN ('SELF', 'PROXY', 'LINK', 'IMPORT'));

CREATE TABLE user_invite_tokens (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   varchar(64) NOT NULL,
    expires_at   timestamptz NOT NULL,
    accepted_at  timestamptz,
    revoked_at   timestamptz,
    created_by   uuid,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_invite_tokens_hash_uq UNIQUE (token_hash)
);

CREATE INDEX user_invite_tokens_user_idx ON user_invite_tokens (user_id);

CREATE TABLE timesheet_links (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES organizations (id),
    resource_id      uuid NOT NULL REFERENCES resources (id),
    week_start_date  date NOT NULL,
    token_hash       varchar(64) NOT NULL,
    expires_at       timestamptz NOT NULL,
    last_opened_at   timestamptz,
    submitted_at     timestamptz,
    revoked_at       timestamptz,
    created_by       uuid,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT timesheet_links_hash_uq UNIQUE (token_hash)
);

CREATE INDEX timesheet_links_resource_week_idx ON timesheet_links (resource_id, week_start_date);

INSERT INTO permissions (code, module, description) VALUES
    ('TIMESHEET_PROXY', 'timesheet', 'Enter and submit timesheets on behalf of managed resources'),
    ('TIMESHEET_IMPORT', 'timesheet', 'Bulk import timesheets from Excel/CSV'),
    ('TIMESHEET_LINK_SEND', 'timesheet', 'Send secure timesheet links to resources without a login'),
    ('RESOURCE_PORTAL_INVITE', 'resource', 'Invite resources to a limited self-service login'),
    ('MY_WORK_VIEW', 'resource', 'View own assignments, tasks and timesheets')
ON CONFLICT (code) DO NOTHING;

-- Approvers and resource managers can enter time for the people they manage, import it and send links.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp.permission_id AND src.code IN ('TIMESHEET_APPROVE', 'RESOURCE_MANAGE')
JOIN permissions p ON p.code IN ('TIMESHEET_PROXY', 'TIMESHEET_IMPORT', 'TIMESHEET_LINK_SEND')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp.permission_id AND src.code = 'RESOURCE_MANAGE'
JOIN permissions p ON p.code = 'RESOURCE_PORTAL_INVITE'
ON CONFLICT DO NOTHING;

-- Everyone who logs their own time gets the My Work page.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp.permission_id AND src.code = 'TIMESHEET_CREATE'
JOIN permissions p ON p.code = 'MY_WORK_VIEW'
ON CONFLICT DO NOTHING;

-- Limited login for contractors / freelancers / consultants: own work and own timesheets only.
-- New organizations copy system roles from the template organization, so this role follows automatically.
INSERT INTO roles (id, organization_id, code, name, data_scope, is_system)
SELECT gen_random_uuid(), o.id, 'EXTERNAL_CONTRIBUTOR', 'External Contributor', 'OWN', true
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM roles r
    WHERE r.organization_id = o.id AND r.code = 'EXTERNAL_CONTRIBUTOR' AND r.deleted_at IS NULL
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'NOTIFICATION_VIEW', 'MY_WORK_VIEW', 'TIMESHEET_VIEW', 'TIMESHEET_CREATE', 'TIMESHEET_SUBMIT'
)
WHERE r.code = 'EXTERNAL_CONTRIBUTOR' AND r.deleted_at IS NULL
ON CONFLICT DO NOTHING;
