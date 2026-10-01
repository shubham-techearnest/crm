-- Custom field values for any metadata table, keyed by (organization, table code, record id).
CREATE TABLE custom_field_values (
    organization_id UUID NOT NULL REFERENCES organizations(id),
    table_code VARCHAR(64) NOT NULL,
    record_id UUID NOT NULL,
    field_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    PRIMARY KEY (organization_id, table_code, record_id)
);

-- Picklist values for ENUM custom fields, one option per line.
ALTER TABLE sys_field ADD COLUMN options TEXT;

-- Runtime metadata resolves fields against the platform table, so custom fields created while an
-- organization table override existed must be re-homed onto the platform table to be visible.
UPDATE sys_field f
SET table_id = base.id
FROM sys_table org_table
JOIN sys_table base ON base.code = org_table.code AND base.organization_id IS NULL
WHERE f.table_id = org_table.id
  AND org_table.organization_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM sys_field existing
      WHERE existing.table_id = base.id
        AND existing.code = f.code
        AND existing.organization_id IS NOT DISTINCT FROM f.organization_id);

INSERT INTO sys_table (id, organization_id, code, label, plural, module_group, active, is_system)
SELECT 'c1000001-0000-4000-8000-0000000000e1', NULL, 'team', 'Team', 'Teams', 'Admin', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM sys_table WHERE code = 'team' AND organization_id IS NULL);

-- Standard fields for admin tables so layouts, field ACLs and the column picker have a dictionary.
INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, active, is_system, sort_order)
SELECT v.id::uuid, NULL, v.table_id::uuid, v.code, v.label, NULL, v.field_type, v.mandatory, TRUE, TRUE, v.sort_order
FROM (VALUES
    ('c2000044-0000-4000-8000-000000000101', 'c1000001-0000-4000-8000-00000000000e', 'firstName', 'First name', 'STRING', TRUE, 10),
    ('c2000044-0000-4000-8000-000000000102', 'c1000001-0000-4000-8000-00000000000e', 'lastName', 'Last name', 'STRING', TRUE, 20),
    ('c2000044-0000-4000-8000-000000000103', 'c1000001-0000-4000-8000-00000000000e', 'email', 'Email', 'STRING', TRUE, 30),
    ('c2000044-0000-4000-8000-000000000104', 'c1000001-0000-4000-8000-00000000000e', 'phone', 'Phone', 'STRING', FALSE, 40),
    ('c2000044-0000-4000-8000-000000000105', 'c1000001-0000-4000-8000-00000000000e', 'mobile', 'Mobile', 'STRING', FALSE, 50),
    ('c2000044-0000-4000-8000-000000000106', 'c1000001-0000-4000-8000-00000000000e', 'jobTitle', 'Job title', 'STRING', FALSE, 60),
    ('c2000044-0000-4000-8000-000000000107', 'c1000001-0000-4000-8000-00000000000e', 'employeeCode', 'Employee code', 'STRING', FALSE, 70),
    ('c2000044-0000-4000-8000-000000000108', 'c1000001-0000-4000-8000-00000000000e', 'dateOfJoining', 'Date of joining', 'DATE', FALSE, 80),
    ('c2000044-0000-4000-8000-000000000109', 'c1000001-0000-4000-8000-00000000000e', 'status', 'Status', 'STRING', FALSE, 90),
    ('c2000044-0000-4000-8000-00000000010a', 'c1000001-0000-4000-8000-00000000000e', 'departmentId', 'Department', 'REFERENCE', FALSE, 100),
    ('c2000044-0000-4000-8000-00000000010b', 'c1000001-0000-4000-8000-00000000000e', 'teamId', 'Team', 'REFERENCE', FALSE, 110),
    ('c2000044-0000-4000-8000-00000000010c', 'c1000001-0000-4000-8000-00000000000e', 'managerId', 'Manager', 'REFERENCE', FALSE, 120),
    ('c2000044-0000-4000-8000-00000000010d', 'c1000001-0000-4000-8000-00000000000e', 'timezone', 'Time zone', 'STRING', FALSE, 130),
    ('c2000044-0000-4000-8000-000000000201', 'c1000001-0000-4000-8000-00000000000f', 'name', 'Role name', 'STRING', TRUE, 10),
    ('c2000044-0000-4000-8000-000000000202', 'c1000001-0000-4000-8000-00000000000f', 'code', 'Code', 'STRING', TRUE, 20),
    ('c2000044-0000-4000-8000-000000000203', 'c1000001-0000-4000-8000-00000000000f', 'dataScope', 'Data scope', 'STRING', TRUE, 30),
    ('c2000044-0000-4000-8000-000000000204', 'c1000001-0000-4000-8000-00000000000f', 'description', 'Description', 'TEXT', FALSE, 40),
    ('c2000044-0000-4000-8000-000000000301', 'c1000001-0000-4000-8000-000000000010', 'name', 'Region name', 'STRING', TRUE, 10),
    ('c2000044-0000-4000-8000-000000000302', 'c1000001-0000-4000-8000-000000000010', 'code', 'Code', 'STRING', TRUE, 20),
    ('c2000044-0000-4000-8000-000000000303', 'c1000001-0000-4000-8000-000000000010', 'parentId', 'Parent region', 'REFERENCE', FALSE, 30),
    ('c2000044-0000-4000-8000-000000000304', 'c1000001-0000-4000-8000-000000000010', 'managerId', 'Manager', 'REFERENCE', FALSE, 40),
    ('c2000044-0000-4000-8000-000000000305', 'c1000001-0000-4000-8000-000000000010', 'timezone', 'Time zone', 'STRING', FALSE, 50),
    ('c2000044-0000-4000-8000-000000000306', 'c1000001-0000-4000-8000-000000000010', 'currencyCode', 'Currency', 'STRING', FALSE, 60),
    ('c2000044-0000-4000-8000-000000000307', 'c1000001-0000-4000-8000-000000000010', 'status', 'Status', 'STRING', FALSE, 70),
    ('c2000044-0000-4000-8000-000000000308', 'c1000001-0000-4000-8000-000000000010', 'description', 'Description', 'TEXT', FALSE, 80),
    ('c2000044-0000-4000-8000-000000000401', 'c1000001-0000-4000-8000-000000000011', 'name', 'Department name', 'STRING', TRUE, 10),
    ('c2000044-0000-4000-8000-000000000402', 'c1000001-0000-4000-8000-000000000011', 'code', 'Code', 'STRING', FALSE, 20),
    ('c2000044-0000-4000-8000-000000000403', 'c1000001-0000-4000-8000-000000000011', 'headId', 'Department head', 'REFERENCE', FALSE, 30),
    ('c2000044-0000-4000-8000-000000000404', 'c1000001-0000-4000-8000-000000000011', 'email', 'Email', 'STRING', FALSE, 40),
    ('c2000044-0000-4000-8000-000000000405', 'c1000001-0000-4000-8000-000000000011', 'status', 'Status', 'STRING', FALSE, 50),
    ('c2000044-0000-4000-8000-000000000406', 'c1000001-0000-4000-8000-000000000011', 'description', 'Description', 'TEXT', FALSE, 60),
    ('c2000044-0000-4000-8000-000000000501', 'c1000001-0000-4000-8000-0000000000e1', 'name', 'Team name', 'STRING', TRUE, 10),
    ('c2000044-0000-4000-8000-000000000502', 'c1000001-0000-4000-8000-0000000000e1', 'departmentId', 'Department', 'REFERENCE', TRUE, 20),
    ('c2000044-0000-4000-8000-000000000503', 'c1000001-0000-4000-8000-0000000000e1', 'managerId', 'Manager', 'REFERENCE', FALSE, 30),
    ('c2000044-0000-4000-8000-000000000504', 'c1000001-0000-4000-8000-0000000000e1', 'email', 'Email', 'STRING', FALSE, 40),
    ('c2000044-0000-4000-8000-000000000505', 'c1000001-0000-4000-8000-0000000000e1', 'status', 'Status', 'STRING', FALSE, 50),
    ('c2000044-0000-4000-8000-000000000506', 'c1000001-0000-4000-8000-0000000000e1', 'description', 'Description', 'TEXT', FALSE, 60)
) AS v(id, table_id, code, label, field_type, mandatory, sort_order)
WHERE EXISTS (SELECT 1 FROM sys_table t WHERE t.id = v.table_id::uuid)
  AND NOT EXISTS (
      SELECT 1 FROM sys_field f
      WHERE f.table_id = v.table_id::uuid AND f.code = v.code AND f.organization_id IS NULL);
