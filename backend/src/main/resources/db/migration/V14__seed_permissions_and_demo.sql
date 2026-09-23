-- Development seed only. Password for every demo user: ChangeMe!123
-- BCrypt strength 12. Do not use these accounts or hashes in production.

INSERT INTO permissions (code, module, description) VALUES
    ('ORG_VIEW', 'organization', 'View organization profile'),
    ('ORG_UPDATE', 'organization', 'Update organization settings'),
    ('ORG_CREATE', 'organization', 'Create organizations'),
    ('REGION_VIEW', 'organization', 'View regions'),
    ('REGION_MANAGE', 'organization', 'Manage regions'),
    ('BRANCH_VIEW', 'organization', 'View branches'),
    ('BRANCH_MANAGE', 'organization', 'Manage branches'),
    ('DEPARTMENT_VIEW', 'organization', 'View departments'),
    ('DEPARTMENT_MANAGE', 'organization', 'Manage departments'),
    ('TEAM_VIEW', 'organization', 'View teams'),
    ('TEAM_MANAGE', 'organization', 'Manage teams'),
    ('USER_VIEW', 'user', 'View users'),
    ('USER_MANAGE', 'user', 'Manage users'),
    ('ROLE_VIEW', 'role', 'View roles'),
    ('ROLE_MANAGE', 'role', 'Manage roles and permissions'),
    ('AUDIT_VIEW', 'audit', 'View audit logs'),
    ('NOTIFICATION_VIEW', 'notification', 'View own notifications'),
    ('DOCUMENT_VIEW', 'document', 'View documents'),
    ('DOCUMENT_UPLOAD', 'document', 'Upload documents'),
    ('DOCUMENT_DELETE', 'document', 'Delete documents'),
    ('LEAD_VIEW', 'lead', 'View leads'),
    ('LEAD_CREATE', 'lead', 'Create leads'),
    ('LEAD_UPDATE', 'lead', 'Update leads'),
    ('LEAD_DELETE', 'lead', 'Soft-delete leads'),
    ('LEAD_ASSIGN', 'lead', 'Assign lead owner'),
    ('LEAD_CONVERT', 'lead', 'Convert leads'),
    ('LEAD_IMPORT', 'lead', 'Import leads'),
    ('LEAD_EXPORT', 'lead', 'Export leads'),
    ('CONTACT_VIEW', 'contact', 'View contacts'),
    ('CONTACT_CREATE', 'contact', 'Create contacts'),
    ('CONTACT_UPDATE', 'contact', 'Update contacts'),
    ('CONTACT_DELETE', 'contact', 'Soft-delete contacts'),
    ('CONTACT_EXPORT', 'contact', 'Export contacts'),
    ('ACCOUNT_VIEW', 'account', 'View accounts'),
    ('ACCOUNT_CREATE', 'account', 'Create accounts'),
    ('ACCOUNT_UPDATE', 'account', 'Update accounts'),
    ('ACCOUNT_DELETE', 'account', 'Soft-delete accounts'),
    ('ACCOUNT_EXPORT', 'account', 'Export accounts'),
    ('DEAL_VIEW', 'deal', 'View deals'),
    ('DEAL_CREATE', 'deal', 'Create deals'),
    ('DEAL_UPDATE', 'deal', 'Update deals'),
    ('DEAL_DELETE', 'deal', 'Soft-delete deals'),
    ('DEAL_STAGE', 'deal', 'Change deal stage'),
    ('DEAL_EXPORT', 'deal', 'Export deals'),
    ('ACTIVITY_VIEW', 'activity', 'View activities'),
    ('ACTIVITY_CREATE', 'activity', 'Create activities'),
    ('ACTIVITY_UPDATE', 'activity', 'Update activities'),
    ('ACTIVITY_DELETE', 'activity', 'Delete activities'),
    ('ACTIVITY_COMPLETE', 'activity', 'Complete activities'),
    ('PROJECT_VIEW', 'project', 'View projects'),
    ('PROJECT_CREATE', 'project', 'Create projects'),
    ('PROJECT_UPDATE', 'project', 'Update projects'),
    ('PROJECT_DELETE', 'project', 'Soft-delete projects'),
    ('MILESTONE_VIEW', 'project', 'View milestones'),
    ('MILESTONE_MANAGE', 'project', 'Manage milestones'),
    ('TASK_VIEW', 'project', 'View project tasks'),
    ('TASK_CREATE', 'project', 'Create tasks'),
    ('TASK_UPDATE', 'project', 'Update tasks'),
    ('TASK_ASSIGN', 'project', 'Assign tasks'),
    ('TASK_DELETE', 'project', 'Soft-delete tasks'),
    ('RESOURCE_VIEW', 'resource', 'View resources'),
    ('RESOURCE_MANAGE', 'resource', 'Manage resources'),
    ('SKILL_VIEW', 'resource', 'View skills'),
    ('SKILL_MANAGE', 'resource', 'Manage skill catalog'),
    ('ALLOCATION_VIEW', 'resource', 'View allocations'),
    ('RESOURCE_ALLOCATE', 'resource', 'Create or update allocations'),
    ('ALLOCATION_OVERRIDE', 'resource', 'Override over-allocation warnings'),
    ('RATE_VIEW', 'resource', 'View cost and billing rates'),
    ('RATE_MANAGE', 'resource', 'Edit cost and billing rates'),
    ('TIMESHEET_VIEW', 'timesheet', 'View timesheets'),
    ('TIMESHEET_CREATE', 'timesheet', 'Create draft timesheets'),
    ('TIMESHEET_SUBMIT', 'timesheet', 'Submit timesheets'),
    ('TIMESHEET_APPROVE', 'timesheet', 'Approve or reject timesheets'),
    ('TIMESHEET_EXPORT', 'timesheet', 'Export timesheets'),
    ('DASHBOARD_ORG', 'dashboard', 'Organization dashboard'),
    ('DASHBOARD_REGION', 'dashboard', 'Regional dashboard'),
    ('DASHBOARD_SALES', 'dashboard', 'Sales dashboard'),
    ('DASHBOARD_PROJECT', 'dashboard', 'Project dashboard'),
    ('DASHBOARD_EMPLOYEE', 'dashboard', 'Employee dashboard'),
    ('REPORT_VIEW', 'report', 'View reports'),
    ('INVOICE_VIEW', 'invoice', 'View invoices'),
    ('INVOICE_CREATE', 'invoice', 'Create invoices'),
    ('INVOICE_UPDATE', 'invoice', 'Update invoices'),
    ('INVOICE_DELETE', 'invoice', 'Void invoices'),
    ('PAYMENT_MANAGE', 'invoice', 'Record payments'),
    ('PO_VIEW', 'procurement', 'View purchase orders'),
    ('PO_CREATE', 'procurement', 'Create purchase orders'),
    ('PO_APPROVE', 'procurement', 'Approve purchase orders'),
    ('EXPENSE_VIEW', 'expense', 'View expenses'),
    ('EXPENSE_CREATE', 'expense', 'Create expenses'),
    ('EXPENSE_APPROVE', 'expense', 'Approve expenses'),
    ('CONTRACT_VIEW', 'contract', 'View contracts'),
    ('CONTRACT_MANAGE', 'contract', 'Manage contracts'),
    ('WORKFLOW_MANAGE', 'workflow', 'Manage workflow definitions'),
    ('APPROVAL_ADMIN', 'approval', 'Manage approval workflows'),
    ('PORTAL_ACCESS', 'portal', 'Customer portal login');

INSERT INTO organizations (
    id, name, slug, legal_name, email, phone, website, timezone, locale, currency_code, status
) VALUES (
    '11111111-1111-4111-8111-111111111111',
    'TechEarnest Demo',
    'techearnest-demo',
    'TechEarnest Demo Private Limited',
    'demo@example.com',
    '+91-2000000000',
    'https://example.com',
    'Asia/Kolkata',
    'en-IN',
    'INR',
    'ACTIVE'
);

INSERT INTO regions (id, organization_id, parent_id, name, code, status) VALUES
    ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-111111111111', NULL, 'West', 'WEST', 'ACTIVE'),
    ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-111111111111', NULL, 'South', 'SOUTH', 'ACTIVE'),
    ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-111111111111', NULL, 'North', 'NORTH', 'ACTIVE');

INSERT INTO regions (id, organization_id, parent_id, name, code, status) VALUES
    ('22222222-2222-4222-8222-000000000011', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-000000000001', 'Pune', 'PUN', 'ACTIVE'),
    ('22222222-2222-4222-8222-000000000012', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-000000000001', 'Mumbai', 'MUM', 'ACTIVE'),
    ('22222222-2222-4222-8222-000000000021', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-000000000002', 'Bangalore', 'BLR', 'ACTIVE'),
    ('22222222-2222-4222-8222-000000000022', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-000000000002', 'Hyderabad', 'HYD', 'ACTIVE'),
    ('22222222-2222-4222-8222-000000000031', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-000000000003', 'Delhi', 'DEL', 'ACTIVE'),
    ('22222222-2222-4222-8222-000000000032', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-000000000003', 'Gurgaon', 'GGN', 'ACTIVE');

INSERT INTO branches (id, organization_id, region_id, name, address, status) VALUES
    ('33333333-3333-4333-8333-000000000011', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-000000000011', 'Pune HQ', 'Hinjawadi, Pune', 'ACTIVE'),
    ('33333333-3333-4333-8333-000000000012', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-000000000012', 'Mumbai Office', 'BKC, Mumbai', 'ACTIVE');

INSERT INTO departments (id, organization_id, branch_id, name, status) VALUES
    ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-111111111111', NULL, 'Sales', 'ACTIVE'),
    ('44444444-4444-4444-8444-000000000002', '11111111-1111-4111-8111-111111111111', NULL, 'Delivery', 'ACTIVE'),
    ('44444444-4444-4444-8444-000000000003', '11111111-1111-4111-8111-111111111111', NULL, 'Finance', 'ACTIVE'),
    ('44444444-4444-4444-8444-000000000004', '11111111-1111-4111-8111-111111111111', NULL, 'People Operations', 'ACTIVE');

INSERT INTO teams (id, organization_id, department_id, name) VALUES
    ('55555555-5555-4555-8555-000000000001', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-000000000001', 'Pune Sales'),
    ('55555555-5555-4555-8555-000000000002', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-000000000002', 'West Delivery');

INSERT INTO roles (id, organization_id, code, name, data_scope, is_system) VALUES
    ('66666666-6666-4666-8666-000000000001', NULL, 'SUPER_ADMIN', 'Super Admin', 'PLATFORM', true),
    ('66666666-6666-4666-8666-000000000002', '11111111-1111-4111-8111-111111111111', 'ORGANIZATION_ADMIN', 'Organization Admin', 'ORGANIZATION', true),
    ('66666666-6666-4666-8666-000000000003', '11111111-1111-4111-8111-111111111111', 'REGIONAL_ADMIN', 'Regional Admin', 'REGION', true),
    ('66666666-6666-4666-8666-000000000004', '11111111-1111-4111-8111-111111111111', 'SALES_MANAGER', 'Sales Manager', 'TEAM', true),
    ('66666666-6666-4666-8666-000000000005', '11111111-1111-4111-8111-111111111111', 'SALES_EXECUTIVE', 'Sales Executive', 'OWN', true),
    ('66666666-6666-4666-8666-000000000006', '11111111-1111-4111-8111-111111111111', 'PROJECT_MANAGER', 'Project Manager', 'TEAM', true),
    ('66666666-6666-4666-8666-000000000007', '11111111-1111-4111-8111-111111111111', 'RESOURCE_MANAGER', 'Resource Manager', 'ORGANIZATION', true),
    ('66666666-6666-4666-8666-000000000008', '11111111-1111-4111-8111-111111111111', 'FINANCE_USER', 'Finance User', 'ORGANIZATION', true),
    ('66666666-6666-4666-8666-000000000009', '11111111-1111-4111-8111-111111111111', 'EMPLOYEE', 'Employee', 'OWN', true),
    ('66666666-6666-4666-8666-000000000010', '11111111-1111-4111-8111-111111111111', 'VIEWER', 'Viewer', 'ORGANIZATION', true);

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000001', id FROM permissions;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000002', id FROM permissions
WHERE code NOT IN ('ORG_CREATE', 'PORTAL_ACCESS');

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000003', id FROM permissions
WHERE code IN (
    'ORG_VIEW', 'REGION_VIEW', 'BRANCH_VIEW', 'BRANCH_MANAGE', 'DEPARTMENT_VIEW', 'TEAM_VIEW', 'TEAM_MANAGE',
    'USER_VIEW', 'USER_MANAGE', 'ROLE_VIEW', 'AUDIT_VIEW', 'NOTIFICATION_VIEW',
    'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD', 'DOCUMENT_DELETE',
    'LEAD_VIEW', 'LEAD_CREATE', 'LEAD_UPDATE', 'LEAD_DELETE', 'LEAD_ASSIGN', 'LEAD_CONVERT', 'LEAD_IMPORT', 'LEAD_EXPORT',
    'CONTACT_VIEW', 'CONTACT_CREATE', 'CONTACT_UPDATE', 'CONTACT_DELETE', 'CONTACT_EXPORT',
    'ACCOUNT_VIEW', 'ACCOUNT_CREATE', 'ACCOUNT_UPDATE', 'ACCOUNT_DELETE', 'ACCOUNT_EXPORT',
    'DEAL_VIEW', 'DEAL_CREATE', 'DEAL_UPDATE', 'DEAL_DELETE', 'DEAL_STAGE', 'DEAL_EXPORT',
    'ACTIVITY_VIEW', 'ACTIVITY_CREATE', 'ACTIVITY_UPDATE', 'ACTIVITY_DELETE', 'ACTIVITY_COMPLETE',
    'PROJECT_VIEW', 'PROJECT_CREATE', 'PROJECT_UPDATE', 'PROJECT_DELETE',
    'MILESTONE_VIEW', 'MILESTONE_MANAGE', 'TASK_VIEW', 'TASK_CREATE', 'TASK_UPDATE', 'TASK_ASSIGN', 'TASK_DELETE',
    'RESOURCE_VIEW', 'RESOURCE_MANAGE', 'SKILL_VIEW', 'ALLOCATION_VIEW', 'RESOURCE_ALLOCATE', 'ALLOCATION_OVERRIDE',
    'RATE_VIEW',
    'TIMESHEET_VIEW', 'TIMESHEET_CREATE', 'TIMESHEET_SUBMIT', 'TIMESHEET_APPROVE', 'TIMESHEET_EXPORT',
    'DASHBOARD_REGION', 'DASHBOARD_SALES', 'DASHBOARD_PROJECT', 'DASHBOARD_EMPLOYEE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000004', id FROM permissions
WHERE code IN (
    'REGION_VIEW', 'BRANCH_VIEW', 'DEPARTMENT_VIEW', 'TEAM_VIEW', 'USER_VIEW', 'NOTIFICATION_VIEW',
    'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD',
    'LEAD_VIEW', 'LEAD_CREATE', 'LEAD_UPDATE', 'LEAD_DELETE', 'LEAD_ASSIGN', 'LEAD_CONVERT', 'LEAD_IMPORT', 'LEAD_EXPORT',
    'CONTACT_VIEW', 'CONTACT_CREATE', 'CONTACT_UPDATE', 'CONTACT_DELETE', 'CONTACT_EXPORT',
    'ACCOUNT_VIEW', 'ACCOUNT_CREATE', 'ACCOUNT_UPDATE', 'ACCOUNT_DELETE', 'ACCOUNT_EXPORT',
    'DEAL_VIEW', 'DEAL_CREATE', 'DEAL_UPDATE', 'DEAL_DELETE', 'DEAL_STAGE', 'DEAL_EXPORT',
    'ACTIVITY_VIEW', 'ACTIVITY_CREATE', 'ACTIVITY_UPDATE', 'ACTIVITY_DELETE', 'ACTIVITY_COMPLETE',
    'PROJECT_VIEW', 'MILESTONE_VIEW', 'TASK_VIEW', 'RESOURCE_VIEW', 'SKILL_VIEW',
    'TIMESHEET_VIEW', 'TIMESHEET_CREATE', 'TIMESHEET_SUBMIT',
    'DASHBOARD_SALES', 'DASHBOARD_EMPLOYEE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000005', id FROM permissions
WHERE code IN (
    'REGION_VIEW', 'DEPARTMENT_VIEW', 'TEAM_VIEW', 'USER_VIEW', 'NOTIFICATION_VIEW',
    'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD',
    'LEAD_VIEW', 'LEAD_CREATE', 'LEAD_UPDATE', 'LEAD_DELETE', 'LEAD_ASSIGN', 'LEAD_CONVERT', 'LEAD_EXPORT',
    'CONTACT_VIEW', 'CONTACT_CREATE', 'CONTACT_UPDATE', 'CONTACT_DELETE',
    'ACCOUNT_VIEW', 'ACCOUNT_CREATE', 'ACCOUNT_UPDATE',
    'DEAL_VIEW', 'DEAL_CREATE', 'DEAL_UPDATE', 'DEAL_STAGE', 'DEAL_EXPORT',
    'ACTIVITY_VIEW', 'ACTIVITY_CREATE', 'ACTIVITY_UPDATE', 'ACTIVITY_COMPLETE',
    'PROJECT_VIEW', 'TASK_VIEW',
    'TIMESHEET_VIEW', 'TIMESHEET_CREATE', 'TIMESHEET_SUBMIT',
    'DASHBOARD_SALES', 'DASHBOARD_EMPLOYEE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000006', id FROM permissions
WHERE code IN (
    'REGION_VIEW', 'DEPARTMENT_VIEW', 'TEAM_VIEW', 'USER_VIEW', 'NOTIFICATION_VIEW',
    'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD',
    'LEAD_VIEW', 'CONTACT_VIEW', 'ACCOUNT_VIEW', 'DEAL_VIEW',
    'ACTIVITY_VIEW', 'ACTIVITY_CREATE', 'ACTIVITY_UPDATE', 'ACTIVITY_COMPLETE',
    'PROJECT_VIEW', 'PROJECT_CREATE', 'PROJECT_UPDATE',
    'MILESTONE_VIEW', 'MILESTONE_MANAGE', 'TASK_VIEW', 'TASK_CREATE', 'TASK_UPDATE', 'TASK_ASSIGN', 'TASK_DELETE',
    'RESOURCE_VIEW', 'SKILL_VIEW', 'ALLOCATION_VIEW', 'RESOURCE_ALLOCATE',
    'TIMESHEET_VIEW', 'TIMESHEET_CREATE', 'TIMESHEET_SUBMIT', 'TIMESHEET_APPROVE',
    'DASHBOARD_PROJECT', 'DASHBOARD_EMPLOYEE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000007', id FROM permissions
WHERE code IN (
    'REGION_VIEW', 'BRANCH_VIEW', 'DEPARTMENT_VIEW', 'TEAM_VIEW', 'USER_VIEW', 'NOTIFICATION_VIEW',
    'DOCUMENT_VIEW',
    'PROJECT_VIEW', 'TASK_VIEW', 'MILESTONE_VIEW',
    'RESOURCE_VIEW', 'RESOURCE_MANAGE', 'SKILL_VIEW', 'SKILL_MANAGE',
    'ALLOCATION_VIEW', 'RESOURCE_ALLOCATE', 'ALLOCATION_OVERRIDE', 'RATE_VIEW', 'RATE_MANAGE',
    'TIMESHEET_VIEW', 'TIMESHEET_CREATE', 'TIMESHEET_SUBMIT', 'TIMESHEET_EXPORT',
    'DASHBOARD_REGION', 'DASHBOARD_PROJECT', 'DASHBOARD_EMPLOYEE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000008', id FROM permissions
WHERE code IN (
    'ORG_VIEW', 'REGION_VIEW', 'USER_VIEW', 'AUDIT_VIEW', 'NOTIFICATION_VIEW',
    'DOCUMENT_VIEW',
    'LEAD_VIEW', 'CONTACT_VIEW', 'ACCOUNT_VIEW', 'ACCOUNT_EXPORT', 'DEAL_VIEW', 'DEAL_EXPORT',
    'PROJECT_VIEW', 'RESOURCE_VIEW', 'ALLOCATION_VIEW', 'RATE_VIEW',
    'TIMESHEET_VIEW', 'TIMESHEET_CREATE', 'TIMESHEET_SUBMIT', 'TIMESHEET_EXPORT',
    'DASHBOARD_ORG', 'DASHBOARD_REGION', 'DASHBOARD_SALES', 'DASHBOARD_PROJECT', 'DASHBOARD_EMPLOYEE',
    'REPORT_VIEW', 'INVOICE_VIEW', 'INVOICE_CREATE', 'INVOICE_UPDATE', 'PAYMENT_MANAGE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000009', id FROM permissions
WHERE code IN (
    'NOTIFICATION_VIEW', 'DOCUMENT_VIEW', 'DOCUMENT_UPLOAD',
    'CONTACT_VIEW', 'ACCOUNT_VIEW',
    'ACTIVITY_VIEW', 'ACTIVITY_CREATE', 'ACTIVITY_UPDATE', 'ACTIVITY_COMPLETE',
    'PROJECT_VIEW', 'TASK_VIEW', 'TASK_UPDATE', 'MILESTONE_VIEW',
    'RESOURCE_VIEW', 'SKILL_VIEW', 'ALLOCATION_VIEW',
    'TIMESHEET_VIEW', 'TIMESHEET_CREATE', 'TIMESHEET_SUBMIT',
    'DASHBOARD_EMPLOYEE'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT '66666666-6666-4666-8666-000000000010', id FROM permissions
WHERE code IN (
    'ORG_VIEW', 'REGION_VIEW', 'BRANCH_VIEW', 'DEPARTMENT_VIEW', 'TEAM_VIEW', 'USER_VIEW',
    'NOTIFICATION_VIEW', 'DOCUMENT_VIEW',
    'LEAD_VIEW', 'CONTACT_VIEW', 'ACCOUNT_VIEW', 'DEAL_VIEW', 'ACTIVITY_VIEW',
    'PROJECT_VIEW', 'MILESTONE_VIEW', 'TASK_VIEW', 'RESOURCE_VIEW', 'SKILL_VIEW', 'ALLOCATION_VIEW',
    'DASHBOARD_ORG', 'DASHBOARD_REGION', 'DASHBOARD_SALES', 'DASHBOARD_PROJECT'
);

INSERT INTO users (
    id, organization_id, region_id, branch_id, department_id, team_id,
    email, password_hash, first_name, last_name, phone, status
) VALUES
    ('77777777-7777-4777-8777-000000000001', NULL, NULL, NULL, NULL, NULL,
     'superadmin@example.com', '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
     'Platform', 'Admin', NULL, 'ACTIVE'),
    ('77777777-7777-4777-8777-000000000002', '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-000000000011', '33333333-3333-4333-8333-000000000011',
     '44444444-4444-4444-8444-000000000004', NULL,
     'orgadmin@example.com', '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
     'Asha', 'Kulkarni', '+91-2000000001', 'ACTIVE'),
    ('77777777-7777-4777-8777-000000000003', '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-000000000011', '33333333-3333-4333-8333-000000000011',
     '44444444-4444-4444-8444-000000000004', NULL,
     'pune.admin@example.com', '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
     'Rahul', 'Deshmukh', '+91-2000000002', 'ACTIVE'),
    ('77777777-7777-4777-8777-000000000004', '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-000000000011', '33333333-3333-4333-8333-000000000011',
     '44444444-4444-4444-8444-000000000001', '55555555-5555-4555-8555-000000000001',
     'sales.manager@example.com', '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
     'Neha', 'Joshi', '+91-2000000003', 'ACTIVE'),
    ('77777777-7777-4777-8777-000000000005', '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-000000000011', '33333333-3333-4333-8333-000000000011',
     '44444444-4444-4444-8444-000000000001', '55555555-5555-4555-8555-000000000001',
     'sales.exec@example.com', '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
     'Karan', 'Patil', '+91-2000000004', 'ACTIVE'),
    ('77777777-7777-4777-8777-000000000006', '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-000000000011', '33333333-3333-4333-8333-000000000011',
     '44444444-4444-4444-8444-000000000002', '55555555-5555-4555-8555-000000000002',
     'pm@example.com', '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
     'Meera', 'Iyer', '+91-2000000005', 'ACTIVE'),
    ('77777777-7777-4777-8777-000000000007', '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-000000000011', '33333333-3333-4333-8333-000000000011',
     '44444444-4444-4444-8444-000000000002', NULL,
     'resource.mgr@example.com', '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
     'Vikram', 'Shah', '+91-2000000006', 'ACTIVE'),
    ('77777777-7777-4777-8777-000000000008', '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-000000000011', '33333333-3333-4333-8333-000000000011',
     '44444444-4444-4444-8444-000000000003', NULL,
     'finance@example.com', '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
     'Sonal', 'Gupta', '+91-2000000007', 'ACTIVE'),
    ('77777777-7777-4777-8777-000000000009', '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-000000000011', '33333333-3333-4333-8333-000000000011',
     '44444444-4444-4444-8444-000000000002', '55555555-5555-4555-8555-000000000002',
     'employee@example.com', '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
     'Arjun', 'Nair', '+91-2000000008', 'ACTIVE'),
    ('77777777-7777-4777-8777-000000000010', '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-000000000011', '33333333-3333-4333-8333-000000000011',
     NULL, NULL,
     'viewer@example.com', '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
     'Isha', 'Rao', '+91-2000000009', 'ACTIVE');

UPDATE users SET manager_id = '77777777-7777-4777-8777-000000000004'
 WHERE id = '77777777-7777-4777-8777-000000000005';
UPDATE users SET manager_id = '77777777-7777-4777-8777-000000000006'
 WHERE id = '77777777-7777-4777-8777-000000000009';
UPDATE teams SET manager_id = '77777777-7777-4777-8777-000000000004'
 WHERE id = '55555555-5555-4555-8555-000000000001';
UPDATE teams SET manager_id = '77777777-7777-4777-8777-000000000006'
 WHERE id = '55555555-5555-4555-8555-000000000002';

INSERT INTO user_roles (user_id, role_id) VALUES
    ('77777777-7777-4777-8777-000000000001', '66666666-6666-4666-8666-000000000001'),
    ('77777777-7777-4777-8777-000000000002', '66666666-6666-4666-8666-000000000002'),
    ('77777777-7777-4777-8777-000000000003', '66666666-6666-4666-8666-000000000003'),
    ('77777777-7777-4777-8777-000000000004', '66666666-6666-4666-8666-000000000004'),
    ('77777777-7777-4777-8777-000000000005', '66666666-6666-4666-8666-000000000005'),
    ('77777777-7777-4777-8777-000000000006', '66666666-6666-4666-8666-000000000006'),
    ('77777777-7777-4777-8777-000000000007', '66666666-6666-4666-8666-000000000007'),
    ('77777777-7777-4777-8777-000000000008', '66666666-6666-4666-8666-000000000008'),
    ('77777777-7777-4777-8777-000000000009', '66666666-6666-4666-8666-000000000009'),
    ('77777777-7777-4777-8777-000000000010', '66666666-6666-4666-8666-000000000010');

INSERT INTO user_regions (user_id, region_id) VALUES
    ('77777777-7777-4777-8777-000000000003', '22222222-2222-4222-8222-000000000011');

INSERT INTO accounts (
    id, organization_id, region_id, owner_id, name, industry, website, email, phone,
    billing_address, status, account_type, description
) VALUES (
    '88888888-8888-4888-8888-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-000000000011',
    '77777777-7777-4777-8777-000000000005',
    'Horizon Retail Pvt Ltd',
    'Retail',
    'https://horizon-retail.example.com',
    'hello@horizon-retail.example.com',
    '+91-2011111111',
    '{"line1":"Kalyani Nagar","city":"Pune","state":"MH","postalCode":"411006","country":"IN"}'::jsonb,
    'ACTIVE',
    'CUSTOMER',
    'Converted from inbound website enquiry.'
);

INSERT INTO contacts (
    id, organization_id, region_id, account_id, owner_id,
    first_name, last_name, email, phone, mobile, designation, department, status
) VALUES (
    '88888888-8888-4888-8888-000000000011',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-000000000011',
    '88888888-8888-4888-8888-000000000001',
    '77777777-7777-4777-8777-000000000005',
    'Priya', 'Sharma', 'priya.sharma@horizon-retail.example.com',
    '+91-2011111112', '+91-9000000001', 'Head of Digital', 'Marketing', 'ACTIVE'
);

INSERT INTO leads (
    id, organization_id, region_id, owner_id, first_name, last_name, company_name, email, phone,
    website, source, status, priority, industry, designation, estimated_value, expected_close_date,
    description, converted_account_id, converted_contact_id, converted_at
) VALUES (
    '88888888-8888-4888-8888-000000000021',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-000000000011',
    '77777777-7777-4777-8777-000000000005',
    'Priya', 'Sharma', 'Horizon Retail Pvt Ltd',
    'priya.sharma@horizon-retail.example.com', '+91-2011111112',
    'https://horizon-retail.example.com', 'WEBSITE', 'CONVERTED', 'HIGH', 'Retail',
    'Head of Digital', 250000, DATE '2026-09-15',
    'Inbound enquiry for a storefront redesign.',
    '88888888-8888-4888-8888-000000000001',
    '88888888-8888-4888-8888-000000000011',
    TIMESTAMPTZ '2026-09-10T10:00:00Z'
);

INSERT INTO deals (
    id, organization_id, region_id, account_id, contact_id, owner_id, lead_id,
    name, stage, value, probability, expected_close_date, source, description, won_at
) VALUES (
    '88888888-8888-4888-8888-000000000031',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-000000000011',
    '88888888-8888-4888-8888-000000000001',
    '88888888-8888-4888-8888-000000000011',
    '77777777-7777-4777-8777-000000000005',
    '88888888-8888-4888-8888-000000000021',
    'Horizon storefront redesign',
    'WON', 250000, 100, DATE '2026-09-15', 'WEBSITE',
    'Fixed-price delivery for a new commerce storefront.',
    TIMESTAMPTZ '2026-09-15T12:00:00Z'
);

UPDATE leads
SET converted_deal_id = '88888888-8888-4888-8888-000000000031'
WHERE id = '88888888-8888-4888-8888-000000000021';

INSERT INTO deal_stage_history (organization_id, deal_id, from_stage, to_stage, changed_by, changed_at) VALUES
    ('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-000000000031', NULL, 'NEW',
     '77777777-7777-4777-8777-000000000005', TIMESTAMPTZ '2026-09-01T09:00:00Z'),
    ('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-000000000031', 'NEW', 'PROPOSAL',
     '77777777-7777-4777-8777-000000000005', TIMESTAMPTZ '2026-09-08T09:00:00Z'),
    ('11111111-1111-4111-8111-111111111111', '88888888-8888-4888-8888-000000000031', 'PROPOSAL', 'WON',
     '77777777-7777-4777-8777-000000000005', TIMESTAMPTZ '2026-09-15T12:00:00Z');

INSERT INTO projects (
    id, organization_id, region_id, account_id, deal_id, project_manager_id,
    name, project_code, description, status, priority, start_date, end_date,
    budget, estimated_hours, actual_hours, billing_type
) VALUES (
    '99999999-9999-4999-8999-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-000000000011',
    '88888888-8888-4888-8888-000000000001',
    '88888888-8888-4888-8888-000000000031',
    '77777777-7777-4777-8777-000000000006',
    'Horizon storefront',
    'HR-WEB-001',
    'Build and launch the Horizon commerce storefront.',
    'ACTIVE', 'HIGH', DATE '2026-09-16', DATE '2026-12-15',
    250000, 480, 24, 'FIXED_PRICE'
);

INSERT INTO milestones (id, organization_id, project_id, name, due_date, status, sort_order) VALUES
    ('99999999-9999-4999-8999-000000000011', '11111111-1111-4111-8111-111111111111',
     '99999999-9999-4999-8999-000000000001', 'Discovery', DATE '2026-09-30', 'ACTIVE', 1),
    ('99999999-9999-4999-8999-000000000012', '11111111-1111-4111-8111-111111111111',
     '99999999-9999-4999-8999-000000000001', 'Build', DATE '2026-11-15', 'PLANNED', 2);

INSERT INTO skills (id, organization_id, name, category) VALUES
    ('aaaaaaa1-aaaa-4aaa-8aaa-000000000001', '11111111-1111-4111-8111-111111111111', 'React', 'Frontend'),
    ('aaaaaaa1-aaaa-4aaa-8aaa-000000000002', '11111111-1111-4111-8111-111111111111', 'Java', 'Backend');

INSERT INTO resources (
    id, organization_id, region_id, user_id, employee_code, designation, department_id, manager_id,
    resource_type, joining_date, cost_rate, billing_rate, capacity_hours_per_week, status
) VALUES (
    'bbbbbbb1-bbbb-4bbb-8bbb-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-000000000011',
    '77777777-7777-4777-8777-000000000009',
    'EMP-1001', 'Software Engineer', '44444444-4444-4444-8444-000000000002',
    '77777777-7777-4777-8777-000000000006',
    'EMPLOYEE', DATE '2024-04-01', 1200, 2500, 40, 'PARTIALLY_ALLOCATED'
);

INSERT INTO resource_skills (resource_id, skill_id, proficiency, years_of_experience) VALUES
    ('bbbbbbb1-bbbb-4bbb-8bbb-000000000001', 'aaaaaaa1-aaaa-4aaa-8aaa-000000000001', 'ADVANCED', 4),
    ('bbbbbbb1-bbbb-4bbb-8bbb-000000000001', 'aaaaaaa1-aaaa-4aaa-8aaa-000000000002', 'INTERMEDIATE', 3);

INSERT INTO project_tasks (
    id, organization_id, project_id, milestone_id, assigned_resource_id, name, description,
    status, priority, start_date, due_date, estimated_hours, actual_hours, completion_percentage
) VALUES
    ('99999999-9999-4999-8999-000000000021', '11111111-1111-4111-8111-111111111111',
     '99999999-9999-4999-8999-000000000001', '99999999-9999-4999-8999-000000000011',
     'bbbbbbb1-bbbb-4bbb-8bbb-000000000001',
     'Discovery workshop', 'Capture current storefront pain points.',
     'COMPLETED', 'HIGH', DATE '2026-09-16', DATE '2026-09-18', 16, 16, 100),
    ('99999999-9999-4999-8999-000000000022', '11111111-1111-4111-8111-111111111111',
     '99999999-9999-4999-8999-000000000001', '99999999-9999-4999-8999-000000000011',
     'bbbbbbb1-bbbb-4bbb-8bbb-000000000001',
     'Information architecture', 'Propose IA and navigation.',
     'IN_PROGRESS', 'MEDIUM', DATE '2026-09-19', DATE '2026-09-30', 40, 8, 20);

INSERT INTO task_dependencies (organization_id, predecessor_task_id, successor_task_id, type) VALUES
    ('11111111-1111-4111-8111-111111111111',
     '99999999-9999-4999-8999-000000000021',
     '99999999-9999-4999-8999-000000000022',
     'FINISH_TO_START');

INSERT INTO resource_allocations (
    id, organization_id, project_id, resource_id, start_date, end_date,
    allocated_hours, allocation_percentage, role, billing_rate, cost_rate, status
) VALUES (
    'ccccccc1-cccc-4ccc-8ccc-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '99999999-9999-4999-8999-000000000001',
    'bbbbbbb1-bbbb-4bbb-8bbb-000000000001',
    DATE '2026-09-16', DATE '2026-12-15',
    320, 50, 'Frontend Engineer', 2500, 1200, 'ACTIVE'
);

INSERT INTO timesheets (
    id, organization_id, resource_id, region_id, week_start_date, status, submitted_at
) VALUES (
    'ddddddd1-dddd-4ddd-8ddd-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbb1-bbbb-4bbb-8bbb-000000000001',
    '22222222-2222-4222-8222-000000000011',
    DATE '2026-09-14',
    'SUBMITTED',
    TIMESTAMPTZ '2026-09-18T18:00:00Z'
);

INSERT INTO time_entries (
    organization_id, timesheet_id, project_id, task_id, work_date, hours, description, billable, billing_rate
) VALUES
    ('11111111-1111-4111-8111-111111111111', 'ddddddd1-dddd-4ddd-8ddd-000000000001',
     '99999999-9999-4999-8999-000000000001', '99999999-9999-4999-8999-000000000021',
     DATE '2026-09-16', 8, 'Discovery workshop', true, 2500),
    ('11111111-1111-4111-8111-111111111111', 'ddddddd1-dddd-4ddd-8ddd-000000000001',
     '99999999-9999-4999-8999-000000000001', '99999999-9999-4999-8999-000000000021',
     DATE '2026-09-17', 8, 'Stakeholder interviews', true, 2500),
    ('11111111-1111-4111-8111-111111111111', 'ddddddd1-dddd-4ddd-8ddd-000000000001',
     '99999999-9999-4999-8999-000000000001', '99999999-9999-4999-8999-000000000022',
     DATE '2026-09-18', 8, 'IA draft', true, 2500);

INSERT INTO activities (
    organization_id, region_id, type, subject, description, status, assigned_to,
    related_entity_type, related_entity_id, created_by
) VALUES
    ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-000000000011',
     'NOTE', 'Lead converted', 'Converted to account, contact, and won deal.', 'COMPLETED',
     '77777777-7777-4777-8777-000000000005', 'LEAD', '88888888-8888-4888-8888-000000000021',
     '77777777-7777-4777-8777-000000000005'),
    ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-000000000011',
     'FOLLOW_UP', 'Kickoff with Horizon', 'Schedule project kickoff with Priya Sharma.', 'OPEN',
     '77777777-7777-4777-8777-000000000006', 'PROJECT', '99999999-9999-4999-8999-000000000001',
     '77777777-7777-4777-8777-000000000006');

INSERT INTO notifications (organization_id, user_id, type, title, message, entity_type, entity_id, read) VALUES
    ('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-000000000005',
     'LEAD_ASSIGNED', 'Lead assigned', 'Horizon Retail enquiry was assigned to you.',
     'LEAD', '88888888-8888-4888-8888-000000000021', true),
    ('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-000000000006',
     'TIMESHEET_SUBMITTED', 'Timesheet submitted', 'Arjun Nair submitted the week of 14 Sep 2026.',
     'TIMESHEET', 'ddddddd1-dddd-4ddd-8ddd-000000000001', false);

INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, new_value) VALUES
    ('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-000000000005',
     'CONVERT', 'LEAD', '88888888-8888-4888-8888-000000000021',
     '{"accountId":"88888888-8888-4888-8888-000000000001","dealId":"88888888-8888-4888-8888-000000000031"}'::jsonb),
    ('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-000000000009',
     'CREATE', 'TIMESHEET', 'ddddddd1-dddd-4ddd-8ddd-000000000001',
     '{"status":"SUBMITTED","weekStartDate":"2026-09-14"}'::jsonb);

INSERT INTO domain_events (organization_id, event_type, payload, processed_at) VALUES
    ('11111111-1111-4111-8111-111111111111', 'DealWonEvent',
     '{"dealId":"88888888-8888-4888-8888-000000000031","projectId":"99999999-9999-4999-8999-000000000001"}'::jsonb,
     TIMESTAMPTZ '2026-09-15T12:01:00Z');
