-- Metadata Studio: Table + Field Dictionary
-- Custom field values: JSONB map on business rows (custom_fields) — definitions live here; max 50 custom fields/table.

CREATE TABLE sys_table (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    code VARCHAR(64) NOT NULL,
    label VARCHAR(128) NOT NULL,
    plural VARCHAR(128) NOT NULL,
    module_group VARCHAR(64) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_sys_table_system_code ON sys_table (code) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX uq_sys_table_org_code ON sys_table (organization_id, code) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_sys_table_org ON sys_table (organization_id);
CREATE INDEX idx_sys_table_group ON sys_table (module_group);

CREATE TABLE sys_field (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    table_id UUID NOT NULL REFERENCES sys_table(id),
    code VARCHAR(64) NOT NULL,
    label VARCHAR(128) NOT NULL,
    help_text VARCHAR(512),
    field_type VARCHAR(32) NOT NULL,
    mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    default_value VARCHAR(512),
    reference_table_code VARCHAR(64),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE UNIQUE INDEX uq_sys_field_system ON sys_field (table_id, code) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX uq_sys_field_org ON sys_field (organization_id, table_id, code) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_sys_field_table ON sys_field (table_id);

INSERT INTO permissions (code, module, description) VALUES
    ('METADATA_VIEW', 'metadata', 'View Metadata Studio dictionary'),
    ('METADATA_MANAGE', 'metadata', 'Manage Metadata Studio dictionary');

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000002', id FROM permissions
WHERE code IN ('METADATA_VIEW', 'METADATA_MANAGE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000001', id FROM permissions
WHERE code IN ('METADATA_VIEW', 'METADATA_MANAGE');

-- Seed system tables (organization_id NULL = platform defaults)
INSERT INTO sys_table (id, organization_id, code, label, plural, module_group, active, is_system) VALUES
    ('c1000001-0000-4000-8000-000000000001', NULL, 'lead', 'Lead', 'Leads', 'CRM', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000002', NULL, 'contact', 'Contact', 'Contacts', 'CRM', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000003', NULL, 'account', 'Account', 'Accounts', 'CRM', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000004', NULL, 'deal', 'Deal', 'Deals', 'CRM', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000005', NULL, 'activity', 'Activity', 'Activities', 'CRM', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000006', NULL, 'document', 'Document', 'Documents', 'CRM', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000007', NULL, 'project', 'Project', 'Projects', 'Delivery', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000008', NULL, 'project_task', 'Project Task', 'Project Tasks', 'Delivery', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000009', NULL, 'milestone', 'Milestone', 'Milestones', 'Delivery', TRUE, TRUE),
    ('c1000001-0000-4000-8000-00000000000a', NULL, 'resource', 'Resource', 'Resources', 'Delivery', TRUE, TRUE),
    ('c1000001-0000-4000-8000-00000000000b', NULL, 'allocation', 'Allocation', 'Allocations', 'Delivery', TRUE, TRUE),
    ('c1000001-0000-4000-8000-00000000000c', NULL, 'skill', 'Skill', 'Skills', 'Delivery', TRUE, TRUE),
    ('c1000001-0000-4000-8000-00000000000d', NULL, 'timesheet', 'Timesheet', 'Timesheets', 'Delivery', TRUE, TRUE),
    ('c1000001-0000-4000-8000-00000000000e', NULL, 'user', 'User', 'Users', 'Admin', TRUE, TRUE),
    ('c1000001-0000-4000-8000-00000000000f', NULL, 'role', 'Role', 'Roles', 'Admin', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000010', NULL, 'region', 'Region', 'Regions', 'Admin', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000011', NULL, 'department', 'Department', 'Departments', 'Admin', TRUE, TRUE),
    ('c1000001-0000-4000-8000-000000000012', NULL, 'organization', 'Organization', 'Organizations', 'Admin', TRUE, TRUE);

-- Seed primary system fields (subset; US-S8-004 expands CRM modules fully)
INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, active, is_system, sort_order) VALUES
    ('c2000001-0000-4000-8000-000000000001', NULL, 'c1000001-0000-4000-8000-000000000001', 'status', 'Status', NULL, 'STRING', TRUE, TRUE, TRUE, 10),
    ('c2000001-0000-4000-8000-000000000002', NULL, 'c1000001-0000-4000-8000-000000000001', 'firstName', 'First name', NULL, 'STRING', TRUE, TRUE, TRUE, 20),
    ('c2000001-0000-4000-8000-000000000003', NULL, 'c1000001-0000-4000-8000-000000000001', 'lastName', 'Last name', NULL, 'STRING', TRUE, TRUE, TRUE, 30),
    ('c2000001-0000-4000-8000-000000000004', NULL, 'c1000001-0000-4000-8000-000000000001', 'companyName', 'Company', NULL, 'STRING', TRUE, TRUE, TRUE, 40),
    ('c2000001-0000-4000-8000-000000000005', NULL, 'c1000001-0000-4000-8000-000000000001', 'ownerId', 'Owner', NULL, 'REFERENCE', FALSE, TRUE, TRUE, 50),
    ('c2000001-0000-4000-8000-000000000011', NULL, 'c1000001-0000-4000-8000-000000000002', 'firstName', 'First name', NULL, 'STRING', TRUE, TRUE, TRUE, 10),
    ('c2000001-0000-4000-8000-000000000012', NULL, 'c1000001-0000-4000-8000-000000000002', 'lastName', 'Last name', NULL, 'STRING', TRUE, TRUE, TRUE, 20),
    ('c2000001-0000-4000-8000-000000000013', NULL, 'c1000001-0000-4000-8000-000000000002', 'email', 'Email', NULL, 'STRING', FALSE, TRUE, TRUE, 30),
    ('c2000001-0000-4000-8000-000000000014', NULL, 'c1000001-0000-4000-8000-000000000002', 'accountId', 'Account', NULL, 'REFERENCE', TRUE, TRUE, TRUE, 40),
    ('c2000001-0000-4000-8000-000000000021', NULL, 'c1000001-0000-4000-8000-000000000003', 'name', 'Account name', NULL, 'STRING', TRUE, TRUE, TRUE, 10),
    ('c2000001-0000-4000-8000-000000000022', NULL, 'c1000001-0000-4000-8000-000000000003', 'status', 'Status', NULL, 'STRING', TRUE, TRUE, TRUE, 20),
    ('c2000001-0000-4000-8000-000000000023', NULL, 'c1000001-0000-4000-8000-000000000003', 'accountType', 'Type', NULL, 'STRING', TRUE, TRUE, TRUE, 30),
    ('c2000001-0000-4000-8000-000000000031', NULL, 'c1000001-0000-4000-8000-000000000004', 'name', 'Deal name', NULL, 'STRING', TRUE, TRUE, TRUE, 10),
    ('c2000001-0000-4000-8000-000000000032', NULL, 'c1000001-0000-4000-8000-000000000004', 'stage', 'Stage', NULL, 'STRING', TRUE, TRUE, TRUE, 20),
    ('c2000001-0000-4000-8000-000000000033', NULL, 'c1000001-0000-4000-8000-000000000004', 'value', 'Value', NULL, 'NUMBER', FALSE, TRUE, TRUE, 30),
    ('c2000001-0000-4000-8000-000000000041', NULL, 'c1000001-0000-4000-8000-000000000005', 'subject', 'Subject', NULL, 'STRING', TRUE, TRUE, TRUE, 10),
    ('c2000001-0000-4000-8000-000000000042', NULL, 'c1000001-0000-4000-8000-000000000005', 'type', 'Type', NULL, 'STRING', TRUE, TRUE, TRUE, 20),
    ('c2000001-0000-4000-8000-000000000043', NULL, 'c1000001-0000-4000-8000-000000000005', 'status', 'Status', NULL, 'STRING', TRUE, TRUE, TRUE, 30),
    ('c2000001-0000-4000-8000-000000000071', NULL, 'c1000001-0000-4000-8000-000000000007', 'name', 'Project name', NULL, 'STRING', TRUE, TRUE, TRUE, 10),
    ('c2000001-0000-4000-8000-000000000072', NULL, 'c1000001-0000-4000-8000-000000000007', 'status', 'Status', NULL, 'STRING', TRUE, TRUE, TRUE, 20),
    ('c2000001-0000-4000-8000-000000000073', NULL, 'c1000001-0000-4000-8000-000000000007', 'accountId', 'Account', NULL, 'REFERENCE', TRUE, TRUE, TRUE, 30),
    ('c2000001-0000-4000-8000-0000000000c1', NULL, 'c1000001-0000-4000-8000-00000000000c', 'name', 'Skill name', NULL, 'STRING', TRUE, TRUE, TRUE, 10),
    ('c2000001-0000-4000-8000-0000000000c2', NULL, 'c1000001-0000-4000-8000-00000000000c', 'category', 'Category', NULL, 'STRING', FALSE, TRUE, TRUE, 20),
    ('c2000001-0000-4000-8000-0000000000d1', NULL, 'c1000001-0000-4000-8000-00000000000d', 'status', 'Status', NULL, 'STRING', TRUE, TRUE, TRUE, 10),
    ('c2000001-0000-4000-8000-0000000000d2', NULL, 'c1000001-0000-4000-8000-00000000000d', 'weekStartDate', 'Week start', NULL, 'DATE', TRUE, TRUE, TRUE, 20),
    ('c2000001-0000-4000-8000-0000000000d3', NULL, 'c1000001-0000-4000-8000-00000000000d', 'resourceId', 'Resource', NULL, 'REFERENCE', TRUE, TRUE, TRUE, 30);
