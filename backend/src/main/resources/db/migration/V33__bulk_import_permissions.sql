-- Bulk import (Excel / CSV) permissions for the core modules. Leads already has LEAD_IMPORT (V14).

INSERT INTO permissions (code, module, description) VALUES
    ('CONTACT_IMPORT', 'contact', 'Bulk import contacts from Excel/CSV'),
    ('ACCOUNT_IMPORT', 'account', 'Bulk import accounts from Excel/CSV'),
    ('DEAL_IMPORT', 'deal', 'Bulk import deals from Excel/CSV'),
    ('PROJECT_IMPORT', 'project', 'Bulk import projects from Excel/CSV'),
    ('RESOURCE_IMPORT', 'resource', 'Bulk import resources from Excel/CSV'),
    ('INVOICE_IMPORT', 'invoice', 'Bulk import draft invoices from Excel/CSV'),
    ('PO_IMPORT', 'procurement', 'Bulk import draft purchase orders from Excel/CSV')
ON CONFLICT (code) DO NOTHING;

-- Every role that can create records in a module can also import them.
INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, imp.id
FROM role_permissions rp
JOIN permissions c ON c.id = rp.permission_id
JOIN permissions imp ON imp.code = CASE c.code
        WHEN 'CONTACT_CREATE' THEN 'CONTACT_IMPORT'
        WHEN 'ACCOUNT_CREATE' THEN 'ACCOUNT_IMPORT'
        WHEN 'DEAL_CREATE' THEN 'DEAL_IMPORT'
        WHEN 'PROJECT_CREATE' THEN 'PROJECT_IMPORT'
        WHEN 'RESOURCE_MANAGE' THEN 'RESOURCE_IMPORT'
        WHEN 'INVOICE_CREATE' THEN 'INVOICE_IMPORT'
        WHEN 'PO_CREATE' THEN 'PO_IMPORT'
    END
ON CONFLICT DO NOTHING;
