-- Wipes accumulated test/demo business data and re-seeds the TechEarnest Demo organization
-- with a realistic dataset. Users (and what they depend on: orgs, regions, branches,
-- departments, teams, roles, permissions, metadata) are kept.
--
-- DEV ONLY. Never run against production. Usage:
--   psql -h localhost -U postgres -d techearnest_crm -v ON_ERROR_STOP=1 -f scripts/reseed-demo-data.sql
--
-- Fixed IDs from V14 (Horizon Retail, HR-WEB-001, EMP-1001, timesheet dddd...0001, etc.)
-- are recreated unchanged because the backend integration tests depend on them.

\set ON_ERROR_STOP on

\set org     11111111-1111-4111-8111-111111111111
\set pun     22222222-2222-4222-8222-000000000011
\set mum     22222222-2222-4222-8222-000000000012
\set blr     22222222-2222-4222-8222-000000000021
\set hyd     22222222-2222-4222-8222-000000000022
\set del     22222222-2222-4222-8222-000000000031
\set ggn     22222222-2222-4222-8222-000000000032
\set sup     77777777-7777-4777-8777-000000000001
\set admin   77777777-7777-4777-8777-000000000002
\set puneadm 77777777-7777-4777-8777-000000000003
\set smgr    77777777-7777-4777-8777-000000000004
\set sales   77777777-7777-4777-8777-000000000005
\set pm      77777777-7777-4777-8777-000000000006
\set rm      77777777-7777-4777-8777-000000000007
\set fin     77777777-7777-4777-8777-000000000008
\set emp     77777777-7777-4777-8777-000000000009
\set viewer  77777777-7777-4777-8777-000000000010
\set dsales  44444444-4444-4444-8444-000000000001
\set ddel    44444444-4444-4444-8444-000000000002
\set dfin    44444444-4444-4444-8444-000000000003
\set dpeople 44444444-4444-4444-8444-000000000004

BEGIN;

-- ID helpers: <prefix>-<n padded to 12 digits>
CREATE FUNCTION pg_temp.u8(n int) RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT ('88888888-8888-4888-8888-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.u9(n int) RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT ('99999999-9999-4999-8999-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.sk(n int) RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT ('aaaaaaa1-aaaa-4aaa-8aaa-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.rs(n int) RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT ('bbbbbbb1-bbbb-4bbb-8bbb-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.al(n int) RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT ('ccccccc1-cccc-4ccc-8ccc-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.ts(n int) RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT ('ddddddd1-dddd-4ddd-8ddd-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.inv(n int) RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT ('eeeeeee1-eeee-4eee-8eee-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.ven(n int) RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT ('fffffff1-ffff-4fff-8fff-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.po(n int)  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT ('fffffff2-ffff-4fff-8fff-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.tx(n int)  RETURNS uuid IMMUTABLE LANGUAGE sql AS $$ SELECT ('fffffff9-ffff-4fff-8fff-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.ist(ts text) RETURNS timestamptz IMMUTABLE LANGUAGE sql AS $$ SELECT (ts::timestamp AT TIME ZONE 'Asia/Kolkata') $$;

-- ---------------------------------------------------------------------------
-- 1. Wipe business / transactional data (all organizations)
-- ---------------------------------------------------------------------------
TRUNCATE TABLE
    workflow_runs, domain_events, audit_logs, notifications, notes, documents,
    approval_actions, approval_requests,
    task_comments, task_dependencies, time_entries, timesheet_links, timesheets,
    resource_allocations, resource_skills, resource_unavailability, resources, resource_code_sequences, skills,
    invoice_payments, invoice_lines, credit_notes, invoices, invoice_number_sequences, tax_rates,
    purchase_order_items, purchase_orders, expenses, vendors,
    contract_expiry_reminders, contracts,
    project_tasks, milestones, projects,
    activities, deal_stage_history, deals, leads, contacts, portal_users, accounts,
    platform_prospect_orgs;

DELETE FROM saved_views WHERE name LIKE 'High Web %';
DELETE FROM refresh_tokens WHERE revoked_at IS NOT NULL OR expires_at < now();

-- ---------------------------------------------------------------------------
-- 2. Remove throw-away organizations created by test runs that have no users
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE junk_orgs ON COMMIT DROP AS
SELECT o.id FROM organizations o
WHERE o.id <> :'org'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.organization_id = o.id);

DELETE FROM sys_field_acl           WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM sys_table_acl           WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM sys_list_layout         WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM sys_form_layout         WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM sys_form_policy         WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM sys_related_list_layout WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM sys_user_list_pref      WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM sys_field               WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM sys_table               WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM approval_steps          WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM approval_workflows      WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM workflow_actions        WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM workflow_definitions    WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM saved_views             WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM resource_board_settings WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM roles                   WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM teams                   WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM departments             WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM branches                WHERE organization_id IN (SELECT id FROM junk_orgs);
UPDATE regions SET parent_id = NULL WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM regions                 WHERE organization_id IN (SELECT id FROM junk_orgs);
DELETE FROM organizations           WHERE id IN (SELECT id FROM junk_orgs);

-- ---------------------------------------------------------------------------
-- 3. CRM: accounts, contacts, leads, deals
-- ---------------------------------------------------------------------------
INSERT INTO accounts (id, organization_id, region_id, owner_id, name, industry, website, email, phone,
                      billing_address, tax_number, status, account_type, description, created_at, created_by)
SELECT pg_temp.u8(v.n), :'org', v.region::uuid, v.owner::uuid, v.name, v.industry,
       'https://' || v.domain, 'hello@' || v.domain, v.phone,
       jsonb_build_object('line1', v.line1, 'city', v.city, 'state', v.state, 'postalCode', v.pin, 'country', 'IN'),
       v.gstin, 'ACTIVE', v.acct_type, v.descr, pg_temp.ist(v.created), v.owner::uuid
FROM (VALUES
    (1,   :'pun', :'sales',   'Horizon Retail Pvt Ltd',            'Retail',               'horizon-retail.example.com',      '+91-2011111111',   'Kalyani Nagar',               'Pune',      'MH', '411006', '27AADCH4821K1Z3', 'CUSTOMER', 'Converted from inbound website enquiry.',                                   '2026-09-10 10:00'),
    (101, :'pun', :'sales',   'Sahyadri Agro Foods Pvt Ltd',       'Food Processing',      'sahyadri-agro.example.com',       '+91-20-6720-4410', 'Plot 14, Hadapsar Industrial Estate', 'Pune', 'MH', '411013', '27AAECS7310M1ZK', 'CUSTOMER', 'Processed fruit and dairy brand; runs SAP Business One across 3 plants.', '2026-05-12 11:30'),
    (102, :'mum', :'sales',   'Konkan Coastal Logistics Ltd',      'Logistics',            'konkan-logistics.example.com',    '+91-22-4971-2200', 'Marol, Andheri East',         'Mumbai',    'MH', '400059', '27AAFCK2291B1Z8', 'CUSTOMER', 'Operates 420 trucks between JNPT, Pune and Goa.',                         '2026-06-03 15:10'),
    (103, :'pun', :'sales',   'Deccan Precision Engineering Pvt Ltd', 'Manufacturing',     'deccan-precision.example.com',    '+91-20-2712-8890', 'Gat 221, Chakan MIDC Phase II', 'Pune',    'MH', '410501', '27AABCD5567Q1ZP', 'CUSTOMER', 'CNC-machined auto components supplier; two plants in Chakan.',           '2026-02-18 09:45'),
    (104, :'mum', :'smgr',    'Marine Drive Capital Advisors LLP', 'Financial Services',   'marinedrive-capital.example.com', '+91-22-6633-1180', 'Maker Chambers IV, Nariman Point', 'Mumbai', 'MH', '400021', '27AAMFM8812C1Z1', 'CUSTOMER', 'Wealth-management boutique serving HNI clients.',                       '2026-04-22 12:00'),
    (105, :'blr', :'smgr',    'Nandi Hills Healthcare Pvt Ltd',    'Healthcare',           'nandihills-health.example.com',   '+91-80-4123-7700', 'ITPL Main Road, Whitefield',  'Bengaluru', 'KA', '560066', '29AAGCN3345H1ZD', 'CUSTOMER', 'Multi-speciality hospital chain with 4 centres in Bengaluru.',          '2026-05-28 16:20'),
    (106, :'hyd', :'smgr',    'Charminar Pharma Labs Ltd',         'Pharmaceuticals',      'charminar-pharma.example.com',    '+91-40-2335-9012', 'Genome Valley, Turkapally',   'Hyderabad', 'TS', '500078', '36AABCC9021L1ZX', 'PROSPECT', 'Generic API manufacturer evaluating QMS digitisation.',                  '2026-08-06 10:15'),
    (107, :'del', :'smgr',    'Yamuna Infra Projects Ltd',         'Construction',         'yamuna-infra.example.com',        '+91-11-4155-6230', 'Eros Corporate Tower, Nehru Place', 'New Delhi', 'DL', '110019', '07AAACY4410E1Z6', 'CUSTOMER', 'EPC contractor for highways and metro stations in NCR.',            '2026-07-14 14:40'),
    (108, :'ggn', :'smgr',    'Aravali EduTech Pvt Ltd',           'Education',            'aravali-edutech.example.com',     '+91-124-455-8810', 'DLF Cyber City, Phase II',    'Gurugram',  'HR', '122002', '06AAKCA6632N1ZQ', 'PROSPECT', 'K-12 test-prep company with 60,000 students.',                           '2026-08-19 11:05'),
    (109, :'pun', :'sales',   'Western Ghats Hospitality Group',   'Hospitality',          'westernghats-hotels.example.com', '+91-20-2553-7100', 'Old Mumbai-Pune Highway, Lonavala', 'Lonavala', 'MH', '410401', '27AAHFW1180G1ZT', 'CUSTOMER', 'Owns 5 resorts across Lonavala, Mahabaleshwar and Panchgani.',     '2026-04-08 13:25'),
    (110, :'mum', :'sales',   'Indus Fintech Solutions Pvt Ltd',   'Financial Technology', 'indus-fintech.example.com',       '+91-22-4890-3321', 'G Block, Bandra Kurla Complex', 'Mumbai',  'MH', '400051', '27AAFCI7754R1ZB', 'PROSPECT', 'NBFC-lending platform scaling digital KYC.',                            '2026-09-02 10:50'),
    (111, :'blr', :'smgr',    'Cloudnine Analytics LLP',           'IT Services',          'cloudnine-analytics.example.com', '+91-80-4718-2290', '80 Feet Road, Koramangala',   'Bengaluru', 'KA', '560034', '29AAQFC2209P1ZM', 'PARTNER',  'Data-engineering partner; co-sells analytics projects with us.',        '2026-03-11 17:00'),
    (112, :'blr', :'smgr',    'Kaveri Textiles Ltd',               'Textiles',             'kaveri-textiles.example.com',     '+91-80-2345-6120', 'Peenya Industrial Area',      'Bengaluru', 'KA', '560058', '29AAACK8870F1ZH', 'PROSPECT', 'Silk and cotton textile maker with 300 dealers.',                        '2026-09-14 12:35'),
    (113, :'hyd', :'smgr',    'Godavari Renewable Energy Ltd',     'Energy',               'godavari-energy.example.com',     '+91-40-6655-4400', 'Mindspace, HITEC City',       'Hyderabad', 'TS', '500081', '36AAHCG5512D1ZW', 'CUSTOMER', 'Runs 180 MW of solar parks across Telangana and AP.',                   '2026-06-24 09:30'),
    (114, :'del', :'smgr',    'Lotus Insurance Brokers Pvt Ltd',   'Insurance',            'lotus-insurance.example.com',     '+91-11-4600-7788', 'Barakhamba Road, Connaught Place', 'New Delhi', 'DL', '110001', '07AACCL3398J1ZE', 'PROSPECT', 'Corporate insurance broker; evaluated us for a renewals CRM.',   '2026-06-30 15:55'),
    (115, :'pun', :'puneadm', 'Printwell Office Supplies',         'Office Supplies',      'printwell.example.com',           '+91-20-2553-4418', 'FC Road, Shivajinagar',       'Pune',      'MH', '411005', '27ABUPS4120K1ZN', 'VENDOR',   'Stationery and printing supplier for the Pune office.',                 '2025-12-01 10:00'),
    (116, :'mum', :'puneadm', 'Bluepeak Cloud Hosting Pvt Ltd',    'Cloud Infrastructure', 'bluepeak-cloud.example.com',      '+91-22-6172-9900', 'Hiranandani Gardens, Powai',  'Mumbai',    'MH', '400076', '27AAICB6604A1ZS', 'VENDOR',   'Managed Kubernetes and database hosting vendor.',                       '2025-12-01 10:00'),
    (117, :'pun', :'puneadm', 'Shree Ganesh Travels',              'Travel',               'shreeganesh-travels.example.com', '+91-20-2444-6710', 'Shankarshet Road, Swargate',  'Pune',      'MH', '411042', '27AAPFS2231H1ZC', 'VENDOR',   'Corporate travel desk for flights, hotels and cabs.',                   '2025-12-01 10:00')
) AS v(n, region, owner, name, industry, domain, phone, line1, city, state, pin, gstin, acct_type, descr, created);

-- Client-portal login for Horizon Retail (same password as the internal demo users).
INSERT INTO portal_users (id, organization_id, account_id, email, password_hash, first_name, last_name, status)
VALUES ('99999999-9999-4999-8999-000000000001', :'org', pg_temp.u8(1), 'portal@horizon-retail.example.com',
        '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS', 'Priya', 'Sharma', 'ACTIVE');

INSERT INTO contacts (id, organization_id, region_id, account_id, owner_id, first_name, last_name, email, phone, mobile,
                      designation, department, linkedin_url, status, created_by)
SELECT pg_temp.u8(v.n), :'org', a.region_id, a.id, a.owner_id, v.first_name, v.last_name,
       lower(v.first_name || '.' || v.last_name) || '@' || substring(a.website FROM 9), a.phone, v.mobile,
       v.designation, v.department,
       'https://www.linkedin.com/in/' || lower(v.first_name || '-' || v.last_name),
       'ACTIVE', a.owner_id
FROM (VALUES
    (11,  1,   'Priya',     'Sharma',      '+91-9000000001', 'Head of Digital',          'Marketing'),
    (201, 1,   'Rohit',     'Malhotra',    '+91-9822014471', 'Chief Technology Officer', 'Technology'),
    (202, 101, 'Sunil',     'Pawar',       '+91-9850331208', 'Managing Director',        'Management'),
    (203, 101, 'Deepa',     'Jadhav',      '+91-9763402215', 'IT Manager',               'IT'),
    (204, 102, 'Imran',     'Shaikh',      '+91-9820553017', 'Head of Operations',       'Operations'),
    (205, 102, 'Pooja',     'Naik',        '+91-9769120483', 'Procurement Lead',         'Procurement'),
    (206, 103, 'Ganesh',    'Kale',        '+91-9881207734', 'Plant Head',               'Manufacturing'),
    (207, 103, 'Swati',     'Bhosale',     '+91-9921450186', 'Finance Controller',       'Finance'),
    (208, 104, 'Nikhil',    'Mehta',       '+91-9833018842', 'Managing Partner',         'Management'),
    (209, 105, 'Lakshmi',   'Narayan',     '+91-9845061127', 'Medical Director',         'Clinical'),
    (210, 105, 'Suresh',    'Gowda',       '+91-9880142273', 'Head of IT',               'IT'),
    (211, 106, 'Venkat',    'Reddy',       '+91-9849027751', 'VP Quality Systems',       'Quality'),
    (212, 107, 'Amit',      'Chauhan',     '+91-9811046630', 'Project Director',         'Projects'),
    (213, 108, 'Ritu',      'Kapoor',      '+91-9818273364', 'Chief Academic Officer',   'Academics'),
    (214, 109, 'Farah',     'Khan',        '+91-9823319905', 'General Manager',          'Operations'),
    (215, 110, 'Siddharth', 'Jain',        '+91-9930284417', 'Co-founder and CEO',       'Management'),
    (216, 111, 'Arvind',    'Subramanian', '+91-9886037712', 'Director, Alliances',      'Partnerships'),
    (217, 112, 'Manjunath', 'Hegde',       '+91-9844210938', 'Director',                 'Management'),
    (218, 113, 'Srinivas',  'Rao',         '+91-9848016650', 'Head of Digital',          'Technology'),
    (219, 113, 'Anjali',    'Varma',       '+91-9701124486', 'Program Manager',          'Technology'),
    (220, 114, 'Harpreet',  'Singh',       '+91-9810437729', 'Principal Officer',        'Management'),
    (221, 115, 'Mahesh',    'Shinde',      '+91-9822761140', 'Proprietor',               'Sales'),
    (222, 116, 'Tanvi',     'Desai',       '+91-9867305528', 'Key Account Manager',      'Sales')
) AS v(n, account_n, first_name, last_name, mobile, designation, department)
JOIN accounts a ON a.id = pg_temp.u8(v.account_n);

UPDATE contacts SET phone = '+91-2011111112', linkedin_url = NULL WHERE id = pg_temp.u8(11);

INSERT INTO leads (id, organization_id, region_id, owner_id, salutation, first_name, last_name, company_name, email, phone, mobile,
                   website, source, status, priority, industry, designation, estimated_value, expected_close_date, description,
                   no_of_employees, rating, address_city, address_state, address_country, created_at, created_by)
SELECT pg_temp.u8(v.n), :'org', v.region::uuid, v.owner::uuid, v.salutation, v.first_name, v.last_name, v.company,
       lower(v.first_name || '.' || v.last_name) || '@' || v.domain, NULL, v.mobile,
       'https://' || v.domain, v.source, v.status, v.priority, v.industry, v.designation, v.est_value, v.close_date::date, v.descr,
       v.employees, v.rating, v.city, v.state, 'India', pg_temp.ist(v.created), v.owner::uuid
FROM (VALUES
    (301, :'mum', :'sales', 'Mr.',  'Kunal',     'Shah',      'Shah Jewellers and Sons',   'shahjewellers.example.com',   '+91-9820117765', 'Web',               'NEW',         'MEDIUM', 'Small/Medium Enterprise', 'Director',            450000,  '2026-12-15', 'Wants an online catalogue for about 3,000 SKUs with store pickup.', 45,  NULL,     'Mumbai',    'Maharashtra', '2026-09-24 11:20'),
    (302, :'del', :'smgr',  'Ms.',  'Neelam',    'Chopra',    'Chopra Diagnostics',        'chopradiagnostics.example.com', '+91-9811552209', 'Employee Referral', 'CONTACTED',   'HIGH',   'Service Provider',        'Operations Head',     800000,  '2026-11-30', 'Lab-report portal with WhatsApp delivery for 12 collection centres.', 180, 'Active', 'New Delhi', 'Delhi',       '2026-09-08 16:05'),
    (303, :'pun', :'sales', 'Mr.',  'Prakash',   'Patil',     'Patil Auto Components',     'patilauto.example.com',       '+91-9890224418', 'Trade Show',        'QUALIFIED',   'HIGH',   'Large Enterprise',        'VP Manufacturing',    1200000, '2026-11-20', 'Met at the Pune auto expo; needs MES integration for 2 plants.', 650, 'Active', 'Pune',      'Maharashtra', '2026-08-21 10:40'),
    (304, :'blr', :'smgr',  'Dr.',  'Meenakshi', 'Sundaram',  'Sundaram Eye Care',         'sundarameyecare.example.com', '+91-9845113390', 'Web',               'PROPOSAL',    'MEDIUM', 'Service Provider',        'Founder',             650000,  '2026-10-31', 'Appointment booking and patient records for 5 clinics.', 90,  'Active', 'Bengaluru', 'Karnataka',   '2026-08-12 12:15'),
    (305, :'del', :'smgr',  'Mr.',  'Abhishek',  'Agarwal',   'Agarwal Cold Chain',        'agarwalcoldchain.example.com', '+91-9810663312', 'Cold Call',        'NEGOTIATION', 'HIGH',   'Large Enterprise',        'CEO',                 950000,  '2026-10-25', 'Temperature monitoring dashboard for 38 reefer trucks.', 220, 'Active', 'New Delhi', 'Delhi',       '2026-07-29 15:30'),
    (306, :'pun', :'sales', 'Mr.',  'Tejas',     'Kulkarni',  'Tejas Realty',              'tejasrealty.example.com',     '+91-9767445520', 'Word of mouth',     'NEW',         'LOW',    'Small/Medium Enterprise', 'Partner',             300000,  '2027-01-15', 'Site-visit booking microsite for two residential projects.', 25,  NULL,     'Pune',      'Maharashtra', '2026-09-27 18:10'),
    (307, :'mum', :'sales', 'Ms.',  'Shalini',   'Menon',     'Menon Legal Associates',    'menonlegal.example.com',      '+91-9833290174', 'Partner',           'CONTACTED',   'MEDIUM', 'Small/Medium Enterprise', 'Senior Partner',      250000,  '2026-12-01', 'Matter-management and billing tool; referred by Cloudnine.', 40,  NULL,     'Mumbai',    'Maharashtra', '2026-09-16 09:50'),
    (308, :'del', :'smgr',  'Mr.',  'Rajiv',     'Bansal',    'Bansal Steel Traders',      'bansalsteel.example.com',     '+91-9811238856', 'Advertisement',     'LOST',        'LOW',    'Small/Medium Enterprise', 'Owner',               200000,  '2026-08-31', 'Chose an off-the-shelf Tally add-on instead.', 30,  'Market Failed', 'New Delhi', 'Delhi', '2026-07-02 11:00'),
    (309, :'pun', :'sales', 'Ms.',  'Aditi',     'Deshpande', 'Aditi Organics',            'aditiorganics.example.com',   '+91-9923118847', 'Online Store',      'QUALIFIED',   'MEDIUM', 'Small/Medium Enterprise', 'Founder',             380000,  '2026-11-10', 'D2C storefront with subscription boxes.', 18,  'Active', 'Pune',      'Maharashtra', '2026-09-05 14:25'),
    (310, :'hyd', :'smgr',  'Mr.',  'Mohammed',  'Arif',      'Arif Leather Exports',      'arifleather.example.com',     '+91-9849551208', 'Trade Show',        'NEW',         'MEDIUM', 'Large Enterprise',        'Export Manager',      520000,  '2026-12-20', 'B2B order portal for European buyers.', 310, NULL,     'Hyderabad', 'Telangana',   '2026-09-22 13:35'),
    (311, :'ggn', :'smgr',  'Mr.',  'Vivek',     'Saxena',    'Saxena Coaching Classes',   'saxenacoaching.example.com',  '+91-9818449921', 'Web',               'PROPOSAL',    'MEDIUM', 'Small/Medium Enterprise', 'Director',            420000,  '2026-11-05', 'Online test series and parent app.', 75,  'Active', 'Gurugram',  'Haryana',     '2026-08-27 10:10'),
    (312, :'pun', :'sales', 'Ms.',  'Kiran',     'Thakur',    'Thakur Hotels and Resorts', 'thakurhotels.example.com',    '+91-9822551196', 'Seminar Partner',   'CONTACTED',   'HIGH',   'Large Enterprise',        'Director, Sales',     700000,  '2026-11-25', 'Central reservations for 3 properties; met at the HAI seminar.', 260, 'Active', 'Pune', 'Maharashtra', '2026-09-11 17:45'),
    (313, :'del', :'smgr',  'Mr.',  'Sanjay',    'Mishra',    'Mishra Pharma Distributors', 'mishrapharma.example.com',   '+91-9810992245', 'Cold Call',         'NEW',         'LOW',    'Small/Medium Enterprise', 'Owner',               350000,  '2027-01-31', 'Order-taking app for 400 chemist outlets.', 55,  NULL,     'New Delhi', 'Delhi',       '2026-09-25 12:00'),
    (314, :'blr', :'smgr',  'Mr.',  'Anand',     'Kamath',    'Kamath Cashew Industries',  'kamathcashew.example.com',    '+91-9845337781', 'External Referral', 'QUALIFIED',   'HIGH',   'Large Enterprise',        'Managing Director',   900000,  '2026-12-05', 'Export traceability and dealer portal.', 420, 'Active', 'Bengaluru', 'Karnataka',   '2026-08-30 11:55'),
    (315, :'pun', :'sales', 'Ms.',  'Rashmi',    'Apte',      'Apte Architects',           'aptearchitects.example.com',  '+91-9763228814', 'Web',               'NEW',         'LOW',    'Small/Medium Enterprise', 'Principal Architect', 180000,  '2027-02-15', 'Portfolio site and client project tracker.', 12,  NULL,     'Pune',      'Maharashtra', '2026-09-29 09:20'),
    (316, :'del', :'smgr',  'Mr.',  'Gaurav',    'Sethi',     'Sethi Motors',              'sethimotors.example.com',     '+91-9811774036', 'Cold Call',         'LOST',        'MEDIUM', 'Small/Medium Enterprise', 'Dealer Principal',    600000,  '2026-09-15', 'Budget frozen until the next financial year.', 140, 'Project Cancelled', 'New Delhi', 'Delhi', '2026-06-18 16:40')
) AS v(n, region, owner, salutation, first_name, last_name, company, domain, mobile, source, status, priority, industry, designation,
       est_value, close_date, descr, employees, rating, city, state, created);

INSERT INTO leads (id, organization_id, region_id, owner_id, first_name, last_name, company_name, email, phone, website, source,
                   status, priority, industry, designation, estimated_value, expected_close_date, description,
                   converted_account_id, converted_contact_id, converted_at, address_city, address_state, address_country, created_at, created_by)
VALUES (pg_temp.u8(21), :'org', :'pun', :'sales', 'Priya', 'Sharma', 'Horizon Retail Pvt Ltd',
        'priya.sharma@horizon-retail.example.com', '+91-2011111112', 'https://horizon-retail.example.com', 'Web',
        'CONVERTED', 'HIGH', 'Retail', 'Head of Digital', 250000, DATE '2026-09-15',
        'Inbound enquiry for a storefront redesign.', pg_temp.u8(1), pg_temp.u8(11), TIMESTAMPTZ '2026-09-10T10:00:00Z',
        'Pune', 'Maharashtra', 'India', pg_temp.ist('2026-08-28 10:30'), :'sales');

INSERT INTO deals (id, organization_id, region_id, account_id, contact_id, owner_id, lead_id, name, stage, value, probability,
                   expected_close_date, source, description, competitor, won_at, lost_at, lost_reason, created_at, created_by)
SELECT pg_temp.u8(v.n), :'org', a.region_id, a.id, pg_temp.u8(v.contact_n), v.owner::uuid,
       CASE WHEN v.n = 31 THEN pg_temp.u8(21) END,
       v.name, v.stage, v.value, v.probability, v.close_date::date, v.source, v.descr, v.competitor,
       CASE WHEN v.stage = 'WON'  THEN pg_temp.ist(v.close_date || ' 12:00') END,
       CASE WHEN v.stage = 'LOST' THEN pg_temp.ist(v.close_date || ' 12:00') END,
       v.lost_reason, pg_temp.ist(v.created), v.owner::uuid
FROM (VALUES
    (31,  1,   11,  :'sales', 'Horizon storefront redesign',       'WON',           250000,  100, '2026-09-15', 'Web',               'Fixed-price delivery for a new commerce storefront.',        NULL,                    NULL, '2026-09-01 09:00'),
    (401, 101, 202, :'sales', 'Sahyadri ERP integration',          'WON',           1850000, 100, '2026-07-20', 'Existing Customer', 'Two-way sync between SAP Business One and the dealer portal.', 'In-house IT team',     NULL, '2026-05-15 11:00'),
    (402, 102, 204, :'sales', 'Konkan fleet tracking portal',      'WON',           2400000, 100, '2026-08-05', 'Trade Show',        'Driver app plus control-tower dashboard for 420 trucks.',     'Off-the-shelf GPS vendor', NULL, '2026-06-05 10:00'),
    (403, 103, 206, :'sales', 'Deccan shop-floor dashboard',       'WON',           950000,  100, '2026-03-25', 'Employee Referral', 'OEE and downtime dashboard for the Chakan plants.',           NULL,                    NULL, '2026-02-20 10:00'),
    (404, 104, 208, :'smgr',  'Marine Drive client onboarding app', 'WON',          1350000, 100, '2026-06-10', 'External Referral', 'Video-KYC onboarding app for new HNI clients.',               NULL,                    NULL, '2026-04-24 12:00'),
    (405, 105, 209, :'smgr',  'Nandi Hills patient portal',        'WON',           1800000, 100, '2026-07-01', 'Web',               'Annual retainer for the patient portal and mobile app.',      'Regional HIS vendor',   NULL, '2026-05-30 16:00'),
    (406, 107, 212, :'smgr',  'Yamuna site inspection app',        'WON',           1100000, 100, '2026-09-22', 'Partner',           'Offline-first inspection app for metro station sites.',       NULL,                    NULL, '2026-07-16 14:00'),
    (407, 109, 214, :'sales', 'Western Ghats booking engine',      'WON',           780000,  100, '2026-05-15', 'Web',               'Direct booking engine for 5 resorts.',                        NULL,                    NULL, '2026-04-09 13:00'),
    (408, 113, 218, :'smgr',  'Godavari solar monitoring',         'WON',           2650000, 100, '2026-07-28', 'Partner',           'Inverter telemetry pipeline and plant analytics.',            'Cloudnine (co-sell)',   NULL, '2026-06-25 09:30'),
    (409, 106, 211, :'smgr',  'Charminar QMS digitisation',        'NEGOTIATION',   2200000, 70,  '2026-10-31', 'Trade Show',        'Deviation, CAPA and change-control workflows.',               'Packaged QMS SaaS',     NULL, '2026-08-07 10:30'),
    (410, 108, 213, :'smgr',  'Aravali learning platform',         'PROPOSAL',      1450000, 50,  '2026-11-15', 'Web',               'Adaptive test-prep platform with a parent app.',              NULL,                    NULL, '2026-08-20 11:00'),
    (411, 110, 215, :'sales', 'Indus Fintech KYC workflow',        'REQUIREMENT',   1600000, 35,  '2026-12-10', 'Partner',           'Automated KYC and underwriting workflow.',                    NULL,                    NULL, '2026-09-03 11:00'),
    (412, 1,   201, :'sales', 'Horizon loyalty app - phase 2',     'QUALIFICATION', 900000,  25,  '2027-01-15', 'Existing Customer', 'Loyalty points and offers in the new storefront app.',        NULL,                    NULL, '2026-09-21 15:00'),
    (413, 112, 217, :'smgr',  'Kaveri dealer portal',              'NEW',           650000,  10,  '2027-01-31', 'Web',               'Ordering and credit-limit portal for 300 dealers.',           NULL,                    NULL, '2026-09-15 12:40'),
    (414, 114, 220, :'smgr',  'Lotus policy renewal CRM',          'LOST',          1200000, 0,   '2026-08-30', 'Cold Call',         'Renewal reminders and broker CRM.',                           'Packaged insurance CRM', 'Price - chose a packaged SaaS', '2026-07-01 10:00'),
    (415, 104, 208, :'smgr',  'Marine Drive portfolio reporting',  'PROPOSAL',      750000,  55,  '2026-11-05', 'Existing Customer', 'Monthly portfolio statements and advisor dashboard.',         NULL,                    NULL, '2026-09-09 12:00'),
    (416, 102, 205, :'sales', 'Konkan warehouse mobile app',       'NEGOTIATION',   1250000, 75,  '2026-10-20', 'Existing Customer', 'Barcode-based putaway and picking app for 3 warehouses.',     NULL,                    NULL, '2026-08-26 10:00')
) AS v(n, account_n, contact_n, owner, name, stage, value, probability, close_date, source, descr, competitor, lost_reason, created)
JOIN accounts a ON a.id = pg_temp.u8(v.account_n);

UPDATE deals SET won_at = TIMESTAMPTZ '2026-09-15T12:00:00Z' WHERE id = pg_temp.u8(31);
UPDATE leads SET converted_deal_id = pg_temp.u8(31) WHERE id = pg_temp.u8(21);

INSERT INTO deal_stage_history (organization_id, deal_id, from_stage, to_stage, changed_by, changed_at) VALUES
    (:'org', pg_temp.u8(31), NULL,       'NEW',      :'sales', TIMESTAMPTZ '2026-09-01T09:00:00Z'),
    (:'org', pg_temp.u8(31), 'NEW',      'PROPOSAL', :'sales', TIMESTAMPTZ '2026-09-08T09:00:00Z'),
    (:'org', pg_temp.u8(31), 'PROPOSAL', 'WON',      :'sales', TIMESTAMPTZ '2026-09-15T12:00:00Z');

WITH open_path AS (
    SELECT ARRAY['NEW', 'QUALIFICATION', 'REQUIREMENT', 'PROPOSAL', 'NEGOTIATION'] AS stages
), p AS (
    SELECT d.id, d.owner_id, d.created_at,
           COALESCE(d.won_at, d.lost_at, pg_temp.ist('2026-09-28 10:00')) AS ended,
           CASE d.stage
               WHEN 'WON'  THEN o.stages || ARRAY['WON']
               WHEN 'LOST' THEN ARRAY['NEW', 'QUALIFICATION', 'PROPOSAL', 'LOST']
               ELSE o.stages[1:array_position(o.stages, d.stage)]
           END AS path
    FROM deals d CROSS JOIN open_path o
    WHERE d.id <> pg_temp.u8(31)
)
INSERT INTO deal_stage_history (organization_id, deal_id, from_stage, to_stage, changed_by, changed_at)
SELECT :'org', p.id,
       lag(s.stage) OVER (PARTITION BY p.id ORDER BY s.ord),
       s.stage, p.owner_id,
       p.created_at + (p.ended - p.created_at) * ((s.ord - 1)::float8 / GREATEST(cardinality(p.path) - 1, 1))
FROM p CROSS JOIN LATERAL unnest(p.path) WITH ORDINALITY AS s(stage, ord);

-- ---------------------------------------------------------------------------
-- 4. Projects, milestones, tasks
-- ---------------------------------------------------------------------------
INSERT INTO projects (id, organization_id, region_id, account_id, deal_id, project_manager_id, name, project_code, description,
                      status, priority, start_date, end_date, budget, estimated_hours, actual_hours, billing_type,
                      hourly_rate, monthly_fee, contract_value, created_by)
SELECT pg_temp.u9(v.n), :'org', :'pun', pg_temp.u8(v.account_n), pg_temp.u8(v.deal_n), v.manager::uuid, v.name, v.code, v.descr,
       v.status, v.priority, v.start_date::date, v.end_date::date, v.budget, v.est_hours, 0, v.billing,
       v.hourly_rate, v.monthly_fee, v.contract_value, v.manager::uuid
FROM (VALUES
    (1,   1,   31,  :'pm',    'Horizon storefront',                'HR-WEB-001',  'Build and launch the Horizon commerce storefront.',                     'ACTIVE',    'HIGH',   '2026-09-16', '2026-12-15', 250000,  480,  'FIXED_BID',          NULL::numeric, NULL::numeric, 250000::numeric),
    (101, 101, 401, :'pm',    'Sahyadri ERP integration',          'SAF-ERP-001', 'Order, inventory and invoice sync between SAP B1 and the dealer portal.', 'ACTIVE',  'HIGH',   '2026-08-03', '2026-12-18', 1850000, 1400, 'TIME_AND_MATERIAL',  1800,   NULL,   NULL),
    (102, 102, 402, :'pm',    'Konkan fleet tracking portal',      'KCL-FLT-001', 'Driver app, GPS ingestion and control-tower dashboard.',                'ACTIVE',    'HIGH',   '2026-08-17', '2027-01-29', 2400000, 1800, 'FIXED_BID',          NULL,   NULL,   2400000),
    (103, 103, 403, :'pm',    'Deccan shop-floor dashboard',       'DPE-MES-001', 'Machine connectors and OEE dashboard for both Chakan plants.',          'COMPLETED', 'MEDIUM', '2026-04-06', '2026-08-14', 950000,  720,  'FIXED_BID',          NULL,   NULL,   950000),
    (104, 104, 404, :'admin', 'Marine Drive client onboarding app', 'MDC-ONB-001', 'Video-KYC onboarding app. On hold pending the client''s compliance review.', 'ON_HOLD', 'MEDIUM', '2026-06-22', '2026-11-27', 1350000, 1000, 'TIME_AND_MATERIAL', 1500,   NULL,   NULL),
    (105, 105, 405, :'pm',    'Nandi Hills patient portal',        'NHH-PP-001',  'Appointments, lab reports and billing for 4 hospitals.',                'ACTIVE',    'HIGH',   '2026-07-06', '2027-06-30', 1800000, 1500, 'FIXED_MONTHLY',      NULL,   150000, NULL),
    (106, 107, 406, :'pm',    'Yamuna site inspection app',        'YIP-INS-001', 'Offline-first inspection checklists with photo evidence.',              'PLANNED',   'MEDIUM', '2026-10-12', '2027-02-26', 1100000, 850,  'FIXED_BID',          NULL,   NULL,   1100000),
    (107, 109, 407, :'admin', 'Western Ghats booking engine',      'WGH-BKG-001', 'Cancelled after the client moved to a channel-manager suite.',          'CANCELLED', 'LOW',    '2026-05-25', '2026-09-30', 780000,  600,  'TIME_AND_MATERIAL',  1400,   NULL,   NULL),
    (108, 113, 408, :'pm',    'Godavari solar monitoring',         'GRE-MON-001', 'MQTT telemetry pipeline and plant performance analytics.',              'ACTIVE',    'HIGH',   '2026-08-10', '2027-03-31', 2650000, 2000, 'STAFF_AUGMENTATION', 1600,   NULL,   NULL)
) AS v(n, account_n, deal_n, manager, name, code, descr, status, priority, start_date, end_date, budget, est_hours, billing,
       hourly_rate, monthly_fee, contract_value);

INSERT INTO milestones (id, organization_id, project_id, name, description, due_date, status, sort_order)
SELECT pg_temp.u9(v.n), :'org', pg_temp.u9(v.project_n), v.name, v.descr, v.due::date, v.status, v.sort_order
FROM (VALUES
    (11,  1,   'Discovery',                 'Workshops, IA and design direction.',          '2026-09-30', 'ACTIVE',    1),
    (12,  1,   'Build',                     'Catalogue, cart, checkout and payments.',      '2026-11-15', 'PLANNED',   2),
    (201, 1,   'UAT and launch',            'Performance audit, UAT and go-live.',          '2026-12-15', 'PLANNED',   3),
    (202, 101, 'Requirements sign-off',     'Order and inventory flows signed off.',        '2026-08-21', 'COMPLETED', 1),
    (203, 101, 'Integration build',         'Order, inventory and invoice sync services.',  '2026-10-30', 'ACTIVE',    2),
    (204, 101, 'Go-live',                   'Cutover and hypercare.',                       '2026-12-18', 'PLANNED',   3),
    (205, 102, 'Driver app MVP',            'Trip tracking and proof of delivery.',         '2026-10-16', 'ACTIVE',    1),
    (206, 102, 'Control-tower dashboard',   'Live map, alerts and SLA reports.',            '2026-12-11', 'PLANNED',   2),
    (207, 102, 'Fleet rollout',             'Rollout to all 420 trucks.',                   '2027-01-29', 'PLANNED',   3),
    (208, 103, 'Pilot line',                'Connectors and dashboard on line 3.',          '2026-05-29', 'COMPLETED', 1),
    (209, 103, 'Plant-wide rollout',        'Both plants live with SOPs.',                  '2026-08-14', 'COMPLETED', 2),
    (210, 104, 'Video-KYC prototype',       'Clickable prototype and compliance review.',   '2026-08-14', 'COMPLETED', 1),
    (211, 104, 'Beta release',              'Beta for 50 clients.',                         '2026-10-30', 'PLANNED',   2),
    (212, 105, 'Appointments module',       'Doctor schedules and online booking.',         '2026-08-28', 'COMPLETED', 1),
    (213, 105, 'Lab reports and billing',   'Report viewer, invoices and payments.',        '2026-11-20', 'ACTIVE',    2),
    (214, 106, 'Design sprint',             'Site visits and checklist design.',            '2026-10-30', 'PLANNED',   1),
    (215, 107, 'Booking MVP',               'Room inventory and payments.',                 '2026-07-31', 'CANCELLED', 1),
    (216, 108, 'Sensor data pipeline',      'MQTT ingestion and time-series storage.',      '2026-10-09', 'ACTIVE',    1),
    (217, 108, 'Analytics dashboards',      'Plant PR, yield and fault dashboards.',        '2026-12-18', 'PLANNED',   2)
) AS v(n, project_n, name, descr, due, status, sort_order);

-- ---------------------------------------------------------------------------
-- 5. Skills and resources (employees are users; contractors/freelancers are external)
-- ---------------------------------------------------------------------------
INSERT INTO skills (id, organization_id, name, category)
SELECT pg_temp.sk(v.n), :'org', v.name, v.category
FROM (VALUES
    (1, 'React', 'Frontend'), (2, 'Java', 'Backend'), (3, 'Spring Boot', 'Backend'), (4, 'TypeScript', 'Frontend'),
    (5, 'PostgreSQL', 'Database'), (6, 'AWS', 'Cloud'), (7, 'Figma', 'Design'), (8, 'Flutter', 'Mobile'),
    (9, 'Selenium', 'Quality'), (10, 'Kubernetes', 'DevOps'), (11, 'Technical Writing', 'Documentation'),
    (12, 'Project Management', 'Delivery'), (13, 'SAP Business One', 'Integration')
) AS v(n, name, category);

INSERT INTO resources (id, organization_id, region_id, user_id, employee_code, full_name, email, phone, designation, department_id,
                       manager_id, resource_type, joining_date, cost_rate, billing_rate, capacity_hours_per_week, status,
                       engagement_end_date, created_by)
SELECT pg_temp.rs(v.n), :'org', v.region::uuid, v.user_id::uuid, v.code, v.full_name, v.email, v.phone, v.designation, v.dept::uuid,
       v.manager::uuid, v.rtype, v.joined::date, v.cost, v.bill, v.capacity, v.status, v.ends::date, :'rm'
FROM (VALUES
    (1,  :'pun', :'emp', 'EMP-1001', NULL,             NULL,                          NULL,             'Software Engineer',       :'ddel',    :'pm',    'EMPLOYEE',   '2024-04-01', 1200, 2500, 40, 'PARTIALLY_ALLOCATED', NULL),
    (2,  :'pun', :'pm',  'EMP-1002', NULL,             NULL,                          NULL,             'Delivery Manager',        :'ddel',    :'admin', 'EMPLOYEE',   '2022-07-11', 1800, 3500, 40, 'PARTIALLY_ALLOCATED', NULL),
    (3,  :'pun', :'rm',  'EMP-1003', NULL,             NULL,                          NULL,             'Resource Manager',        :'dpeople', :'admin', 'EMPLOYEE',   '2021-01-18', 1600, 3000, 40, 'AVAILABLE',           NULL),
    (11, :'pun', NULL,   'CON-001',  'Rohan Mehta',    'rohan.mehta@example.com',     '+91-9822043157', 'Senior Java Developer',   :'ddel',    :'rm',    'CONTRACTOR', '2026-03-02', 1500, 3200, 40, 'FULLY_ALLOCATED',     '2027-03-31'),
    (12, :'pun', NULL,   'CON-002',  'Sneha Pillai',   'sneha.pillai@example.com',    '+91-9886412290', 'QA Automation Engineer',  :'ddel',    :'rm',    'CONTRACTOR', '2026-06-15', 1100, 2200, 40, 'FULLY_ALLOCATED',     '2027-06-30'),
    (13, :'pun', NULL,   'CON-003',  'Aditya Verma',   'aditya.verma@example.com',    '+91-9811367724', 'DevOps Engineer',         :'ddel',    :'rm',    'CONTRACTOR', '2026-08-10', 1400, 2800, 40, 'FULLY_ALLOCATED',     '2027-02-28'),
    (21, :'blr', NULL,   'FRL-001',  'Kavya Menon',    'kavya.menon@example.com',     '+91-9845290631', 'UI/UX Designer',          :'ddel',    :'rm',    'FREELANCER', '2025-11-03', 1300, 2600, 30, 'PARTIALLY_ALLOCATED', NULL),
    (22, :'pun', NULL,   'FRL-002',  'Farhan Qureshi', 'farhan.qureshi@example.com',  '+91-9849176605', 'Flutter Developer',       :'ddel',    :'rm',    'FREELANCER', '2026-08-17', 1200, 2400, 35, 'FULLY_ALLOCATED',     '2027-01-31'),
    (23, :'pun', NULL,   'FRL-003',  'Ananya Bose',    'ananya.bose@example.com',     '+91-9830551874', 'Technical Writer',        :'ddel',    :'rm',    'FREELANCER', '2026-04-13', 900,  1800, 20, 'INACTIVE',            '2026-08-31')
) AS v(n, region, user_id, code, full_name, email, phone, designation, dept, manager, rtype, joined, cost, bill, capacity, status, ends);

INSERT INTO resource_code_sequences (organization_id, prefix, last_value) VALUES
    (:'org', 'EMP', 1003), (:'org', 'CON', 3), (:'org', 'FRL', 3);

INSERT INTO resource_skills (resource_id, skill_id, proficiency, years_of_experience)
SELECT pg_temp.rs(v.r), pg_temp.sk(v.s), v.level, v.years
FROM (VALUES
    (1, 1, 'ADVANCED', 4), (1, 2, 'INTERMEDIATE', 3), (1, 4, 'ADVANCED', 4), (1, 3, 'INTERMEDIATE', 2),
    (2, 12, 'EXPERT', 11), (2, 2, 'ADVANCED', 8),
    (3, 12, 'ADVANCED', 9),
    (11, 2, 'EXPERT', 9), (11, 3, 'EXPERT', 7), (11, 5, 'ADVANCED', 6), (11, 13, 'ADVANCED', 4),
    (12, 9, 'EXPERT', 6), (12, 4, 'INTERMEDIATE', 3),
    (13, 6, 'ADVANCED', 5), (13, 10, 'ADVANCED', 4), (13, 5, 'INTERMEDIATE', 3),
    (21, 7, 'EXPERT', 7), (21, 1, 'INTERMEDIATE', 2),
    (22, 8, 'ADVANCED', 4), (22, 4, 'INTERMEDIATE', 2),
    (23, 11, 'EXPERT', 8)
) AS v(r, s, level, years);

INSERT INTO project_tasks (id, organization_id, project_id, milestone_id, assigned_resource_id, name, description, status, priority,
                           start_date, due_date, estimated_hours, actual_hours, completion_percentage, created_by)
SELECT pg_temp.u9(v.n), :'org', pg_temp.u9(v.project_n), pg_temp.u9(v.milestone_n),
       CASE WHEN v.resource_n IS NOT NULL THEN pg_temp.rs(v.resource_n) END,
       v.name, v.descr, v.status, v.priority, v.start_date::date, v.due::date, v.est, 0, v.pct, :'pm'
FROM (VALUES
    (21,  1,   11,  1,    'Discovery workshop',              'Capture current storefront pain points.',                 'COMPLETED',   'HIGH',   '2026-09-16', '2026-09-18', 16,  100),
    (22,  1,   11,  1,    'Information architecture',        'Propose IA and navigation.',                              'IN_PROGRESS', 'MEDIUM', '2026-09-19', '2026-09-30', 40,  20),
    (301, 1,   12,  21,   'Checkout UX design',              'Wireframes and visual design for cart and checkout.',     'IN_PROGRESS', 'HIGH',   '2026-09-16', '2026-10-09', 60,  40),
    (302, 1,   12,  1,    'Payment gateway integration',     'Razorpay integration with UPI and card flows.',           'TODO',        'HIGH',   '2026-10-12', '2026-10-30', 50,  0),
    (303, 1,   201, NULL, 'Performance and SEO audit',       'Lighthouse and Core Web Vitals pass before launch.',      'TODO',        'MEDIUM', '2026-11-23', '2026-12-04', 24,  0),
    (304, 101, 202, 11,   'Map SAP B1 order flows',          'Document order-to-invoice flows with the Sahyadri IT team.', 'COMPLETED', 'HIGH',   '2026-08-03', '2026-08-21', 80,  100),
    (305, 101, 203, 11,   'Build order-sync service',        'Spring Boot service syncing orders from the dealer portal to SAP B1.', 'IN_PROGRESS', 'HIGH', '2026-08-24', '2026-10-16', 240, 60),
    (306, 101, 203, 1,    'Inventory sync API',              'Near-real-time stock levels per plant and warehouse.',    'IN_PROGRESS', 'HIGH',   '2026-08-31', '2026-10-23', 160, 35),
    (307, 101, 204, NULL, 'Integration test suite',          'End-to-end tests for order, stock and invoice sync.',     'TODO',        'MEDIUM', '2026-10-26', '2026-11-20', 80,  0),
    (308, 101, 204, 2,    'Cutover and hypercare plan',      'Cutover runbook, rollback plan and hypercare roster.',    'TODO',        'MEDIUM', '2026-11-23', '2026-12-04', 24,  0),
    (309, 102, 205, 22,   'Driver app - trip tracking',      'Flutter app with background GPS and trip timeline.',      'IN_PROGRESS', 'HIGH',   '2026-08-24', '2026-10-09', 180, 45),
    (310, 102, 205, 13,   'GPS ingestion service',           'Ingest pings from 420 devices into PostgreSQL/Timescale.', 'IN_PROGRESS', 'HIGH',  '2026-08-24', '2026-10-02', 120, 50),
    (311, 102, 206, NULL, 'Control-tower wireframes',        'Live map, exceptions list and SLA widgets.',              'TODO',        'MEDIUM', '2026-10-12', '2026-10-30', 40,  0),
    (312, 102, 205, 22,   'Proof-of-delivery capture',       'Photo, signature and OTP capture at drop points.',        'TODO',        'MEDIUM', '2026-10-05', '2026-10-16', 60,  0),
    (313, 103, 208, 11,   'Machine data connectors',         'OPC-UA connectors for 38 CNC machines.',                  'COMPLETED',   'HIGH',   '2026-04-06', '2026-05-22', 200, 100),
    (314, 103, 209, 23,   'User manual and SOPs',            'Operator manuals and supervisor SOPs in English and Marathi.', 'COMPLETED', 'MEDIUM', '2026-06-01', '2026-08-14', 80, 100),
    (315, 103, 209, 11,   'OEE dashboard',                   'Availability, performance and quality dashboard per line.', 'COMPLETED', 'HIGH',   '2026-05-25', '2026-07-31', 240, 100),
    (316, 104, 210, 1,    'Video-KYC prototype',             'Clickable prototype of the video-KYC journey.',           'COMPLETED',   'HIGH',   '2026-06-22', '2026-07-31', 120, 100),
    (317, 104, 211, NULL, 'Beta hardening',                  'Blocked until the client''s compliance review completes.', 'BLOCKED',    'MEDIUM', '2026-08-17', '2026-10-30', 160, 10),
    (318, 105, 212, 12,   'Appointment booking QA',          'Regression and UAT support for online booking.',          'COMPLETED',   'HIGH',   '2026-07-06', '2026-08-28', 120, 100),
    (319, 105, 213, 21,   'Lab report viewer design',        'Report viewer, trends and PDF download screens.',         'IN_PROGRESS', 'MEDIUM', '2026-08-31', '2026-10-16', 90,  55),
    (320, 105, 213, 12,   'Billing regression tests',        'Selenium suite for invoices, payments and refunds.',      'IN_PROGRESS', 'MEDIUM', '2026-09-07', '2026-11-06', 100, 30),
    (321, 106, 214, 2,    'Kick-off and site visits',        'Kick-off in Delhi and visits to 3 metro sites.',          'TODO',        'MEDIUM', '2026-10-12', '2026-10-23', 40,  0),
    (322, 107, 215, NULL, 'Room inventory API',              'Cancelled with the project.',                             'CANCELLED',   'LOW',    '2026-06-01', '2026-07-17', 80,  0),
    (323, 108, 216, 13,   'MQTT ingestion pipeline',         'Broker, consumers and time-series storage for inverter data.', 'IN_PROGRESS', 'HIGH', '2026-08-10', '2026-10-09', 160, 55),
    (324, 108, 216, 12,   'Pipeline load testing',           'Simulate 12,000 inverters at 1-minute intervals.',        'IN_PROGRESS', 'MEDIUM', '2026-09-07', '2026-10-09', 60,  25),
    (325, 108, 217, NULL, 'Analytics dashboard design',      'PR ratio, yield and fault dashboards.',                   'TODO',        'MEDIUM', '2026-10-12', '2026-11-06', 50,  0)
) AS v(n, project_n, milestone_n, resource_n, name, descr, status, priority, start_date, due, est, pct);

INSERT INTO task_dependencies (organization_id, predecessor_task_id, successor_task_id, type)
SELECT :'org', pg_temp.u9(v.a), pg_temp.u9(v.b), 'FINISH_TO_START'
FROM (VALUES (21, 22), (22, 302), (304, 305), (305, 307), (306, 307), (307, 308), (309, 312), (313, 315), (323, 324)) AS v(a, b);

INSERT INTO task_comments (organization_id, task_id, author_id, body, created_at)
SELECT :'org', pg_temp.u9(v.task_n), v.author::uuid, v.body, pg_temp.ist(v.at)
FROM (VALUES
    (22,  :'emp', 'First IA draft shared with Priya; waiting for feedback on the category tree.',             '2026-09-24 17:20'),
    (22,  :'pm',  'Priya wants seasonal collections as a top-level menu. Please update before Friday.',       '2026-09-25 10:05'),
    (305, :'pm',  'Sahyadri IT confirmed the SAP B1 service-layer credentials for the QA company database.', '2026-09-10 12:30'),
    (309, :'pm',  'Background location drains battery on older Android phones - please test on the Redmi devices.', '2026-09-22 16:45'),
    (317, :'admin', 'Client compliance team expects to close the review by mid-October.',                      '2026-09-18 11:00'),
    (323, :'pm',  'Godavari shared the inverter MQTT topic map. Aditya to align the schema.',                '2026-09-15 15:10')
) AS v(task_n, author, body, at);

INSERT INTO resource_allocations (id, organization_id, project_id, resource_id, start_date, end_date, allocated_hours,
                                  allocation_percentage, role, billing_rate, cost_rate, status, created_by)
SELECT pg_temp.al(v.n), :'org', pg_temp.u9(v.project_n), r.id, v.start_date::date, v.end_date::date,
       COALESCE(v.hours, round(((v.end_date::date - v.start_date::date + 1) / 7.0) * r.capacity_hours_per_week * v.pct / 100)),
       v.pct, v.role, r.billing_rate, r.cost_rate, v.status, :'rm'
FROM (VALUES
    (1,  1,   1,  '2026-09-16', '2026-12-15', 320,  50,  'Frontend Engineer',  'ACTIVE'),
    (2,  101, 1,  '2026-08-03', '2026-11-30', NULL, 40,  'Backend Engineer',   'ACTIVE'),
    (3,  101, 11, '2026-08-03', '2026-12-18', NULL, 100, 'Integration Lead',   'ACTIVE'),
    (4,  101, 2,  '2026-08-03', '2026-12-18', NULL, 20,  'Delivery Manager',   'ACTIVE'),
    (5,  102, 2,  '2026-08-17', '2027-01-29', NULL, 20,  'Delivery Manager',   'ACTIVE'),
    (6,  102, 13, '2026-08-17', '2027-01-29', NULL, 60,  'DevOps Engineer',    'ACTIVE'),
    (7,  102, 22, '2026-08-17', '2027-01-29', NULL, 100, 'Mobile Developer',   'ACTIVE'),
    (8,  1,   21, '2026-09-16', '2026-12-15', NULL, 50,  'UX Designer',        'ACTIVE'),
    (9,  105, 21, '2026-07-06', '2026-12-31', NULL, 40,  'UX Designer',        'ACTIVE'),
    (10, 105, 12, '2026-07-06', '2026-12-31', NULL, 50,  'QA Engineer',        'ACTIVE'),
    (11, 108, 12, '2026-08-10', '2027-03-31', NULL, 50,  'QA Engineer',        'ACTIVE'),
    (12, 108, 13, '2026-08-10', '2027-03-31', NULL, 40,  'DevOps Engineer',    'ACTIVE'),
    (13, 103, 11, '2026-04-06', '2026-07-31', NULL, 100, 'Java Developer',     'COMPLETED'),
    (14, 103, 23, '2026-06-01', '2026-08-14', NULL, 100, 'Technical Writer',   'COMPLETED'),
    (15, 104, 1,  '2026-06-22', '2026-07-31', NULL, 50,  'Frontend Engineer',  'COMPLETED'),
    (16, 106, 2,  '2026-10-12', '2027-02-26', NULL, 10,  'Delivery Manager',   'PLANNED'),
    (17, 107, 21, '2026-06-01', '2026-07-17', NULL, 30,  'UX Designer',        'CANCELLED')
) AS v(n, project_n, resource_n, start_date, end_date, hours, pct, role, status)
JOIN resources r ON r.id = pg_temp.rs(v.resource_n);

-- ---------------------------------------------------------------------------
-- 6. Timesheets and time entries
-- ---------------------------------------------------------------------------
INSERT INTO timesheets (id, organization_id, resource_id, region_id, week_start_date, status, submitted_at, approved_at, approved_by,
                        rejection_reason, entered_by, entry_source, notes, created_by, created_at)
SELECT pg_temp.ts(v.n), :'org', r.id, r.region_id, v.week::date, v.status,
       CASE WHEN v.status <> 'DRAFT' THEN pg_temp.ist(v.week || ' 18:00') + interval '4 days' END,
       CASE WHEN v.status = 'APPROVED' THEN pg_temp.ist(v.week || ' 11:00') + interval '7 days' END,
       CASE WHEN v.status = 'APPROVED' THEN :'pm'::uuid END,
       v.rejection,
       COALESCE(v.entered_by::uuid, r.user_id),
       v.source, v.notes,
       COALESCE(v.entered_by::uuid, r.user_id, r.manager_id),
       pg_temp.ist(v.week || ' 09:30')
FROM (VALUES
    (1,   1,  '2026-09-14', 'SUBMITTED', 'SELF',  NULL,   NULL, NULL),
    (101, 1,  '2026-08-31', 'APPROVED',  'SELF',  NULL,   NULL, NULL),
    (102, 1,  '2026-09-07', 'APPROVED',  'SELF',  NULL,   NULL, NULL),
    (103, 1,  '2026-09-21', 'SUBMITTED', 'SELF',  NULL,   NULL, 'Split between Horizon IA and Sahyadri inventory sync.'),
    (104, 1,  '2026-09-28', 'DRAFT',     'SELF',  NULL,   NULL, NULL),
    (111, 11, '2026-08-31', 'APPROVED',  'LINK',  NULL,   NULL, NULL),
    (112, 11, '2026-09-07', 'APPROVED',  'LINK',  NULL,   NULL, NULL),
    (113, 11, '2026-09-14', 'APPROVED',  'LINK',  NULL,   NULL, NULL),
    (114, 11, '2026-09-21', 'SUBMITTED', 'LINK',  NULL,   NULL, NULL),
    (115, 11, '2026-07-27', 'APPROVED',  'LINK',  NULL,   NULL, 'Final week on the Deccan dashboard.'),
    (121, 12, '2026-09-07', 'APPROVED',  'LINK',  NULL,   NULL, NULL),
    (122, 12, '2026-09-14', 'APPROVED',  'LINK',  NULL,   NULL, NULL),
    (123, 12, '2026-09-21', 'SUBMITTED', 'PROXY', :'rm',  NULL, 'Entered by Vikram from Sneha''s email.'),
    (131, 13, '2026-09-14', 'APPROVED',  'LINK',  NULL,   NULL, NULL),
    (132, 13, '2026-09-21', 'SUBMITTED', 'LINK',  NULL,   NULL, NULL),
    (141, 21, '2026-09-14', 'APPROVED',  'LINK',  NULL,   NULL, NULL),
    (142, 21, '2026-09-21', 'SUBMITTED', 'LINK',  NULL,   NULL, NULL),
    (151, 22, '2026-09-07', 'REJECTED',  'LINK',  NULL,   'Please split the hours between trip tracking and proof-of-delivery.', NULL),
    (152, 22, '2026-09-14', 'APPROVED',  'LINK',  NULL,   NULL, NULL),
    (153, 22, '2026-09-28', 'DRAFT',     'LINK',  NULL,   NULL, NULL),
    (161, 2,  '2026-09-21', 'SUBMITTED', 'SELF',  NULL,   NULL, 'Sprint reviews and client status calls.'),
    (171, 23, '2026-08-10', 'APPROVED',  'LINK',  NULL,   NULL, 'Final SOP handover.')
) AS v(n, resource_n, week, status, source, entered_by, rejection, notes)
JOIN resources r ON r.id = pg_temp.rs(v.resource_n);

UPDATE timesheets SET submitted_at = TIMESTAMPTZ '2026-09-18T18:00:00Z' WHERE id = pg_temp.ts(1);

INSERT INTO time_entries (organization_id, timesheet_id, project_id, task_id, work_date, hours, description, billable, billing_rate)
SELECT :'org', t.id, pg_temp.u9(p.project_n), CASE WHEN p.task_n IS NOT NULL THEN pg_temp.u9(p.task_n) END,
       t.week_start_date + d.offset_days, p.hours, p.descr, p.billable, CASE WHEN p.billable THEN r.billing_rate END
FROM (VALUES
    (1,   1,   21,   8, '{2}'::int[],         'Discovery workshop',                  true),
    (1,   1,   21,   8, '{3}'::int[],         'Stakeholder interviews',              true),
    (1,   1,   22,   8, '{4}'::int[],         'IA draft',                            true),
    (101, 101, 306,  8, '{0,1,2,3,4}'::int[], 'Inventory sync API - data model',     true),
    (102, 101, 306,  8, '{0,1,2,3,4}'::int[], 'Inventory sync API - stock endpoints', true),
    (103, 1,   22,   4, '{0,1,2,3,4}'::int[], 'IA revisions with Priya',             true),
    (103, 101, 306,  4, '{0,1,2,3,4}'::int[], 'Inventory sync API - plant mapping',  true),
    (104, 1,   302,  8, '{0,1}'::int[],       'Razorpay sandbox setup',              true),
    (111, 101, 305,  8, '{0,1,2,3,4}'::int[], 'Order-sync service skeleton',         true),
    (112, 101, 305,  8, '{0,1,2,3,4}'::int[], 'Order mapping and retries',           true),
    (113, 101, 305,  8, '{0,1,2,3,4}'::int[], 'SAP B1 service-layer integration',    true),
    (114, 101, 305,  8, '{0,1,2,3,4}'::int[], 'Invoice sync and error queue',        true),
    (115, 103, 315,  8, '{0,1,2,3,4}'::int[], 'OEE dashboard fixes and handover',    true),
    (121, 105, 320,  4, '{0,1,2,3,4}'::int[], 'Billing regression suite',            true),
    (121, 108, 324,  4, '{0,1,2,3,4}'::int[], 'Load-test harness',                   true),
    (122, 105, 320,  4, '{0,1,2,3,4}'::int[], 'Refund scenarios',                    true),
    (122, 108, 324,  4, '{0,1,2,3,4}'::int[], '12k-inverter load test',              true),
    (123, 105, 320,  4, '{0,1,2,3,4}'::int[], 'Payment gateway regression',          true),
    (123, 108, 324,  4, '{0,1,2,3,4}'::int[], 'Soak test and report',                true),
    (131, 102, 310,  5, '{0,1,2,3,4}'::int[], 'GPS ingestion on Kubernetes',         true),
    (131, 108, 323,  3, '{0,1,2,3,4}'::int[], 'MQTT broker setup',                   true),
    (132, 102, 310,  5, '{0,1,2,3,4}'::int[], 'Ingestion autoscaling',               true),
    (132, 108, 323,  3, '{0,1,2,3,4}'::int[], 'Consumer deployment',                 true),
    (141, 105, 319,  3, '{0,1,2,3,4}'::int[], 'Lab report viewer screens',           true),
    (141, 1,   301,  4, '{2,3,4}'::int[],     'Checkout wireframes',                 true),
    (142, 105, 319,  3, '{0,1,2,3,4}'::int[], 'Trends and PDF download',             true),
    (142, 1,   301,  4, '{0,1,2,3,4}'::int[], 'Checkout visual design',              true),
    (151, 102, 309,  7, '{0,1,2,3,4}'::int[], 'Driver app work',                     true),
    (152, 102, 309,  5, '{0,1,2,3,4}'::int[], 'Trip timeline and background GPS',    true),
    (152, 102, 312,  2, '{0,1,2,3,4}'::int[], 'Proof-of-delivery camera flow',       true),
    (153, 102, 309,  7, '{0,1,2}'::int[],     'Battery optimisation on Android',     true),
    (161, 101, 308,  2, '{0,1,2,3,4}'::int[], 'Sahyadri status call and cutover plan', false),
    (161, 102, NULL, 2, '{0,1,2,3,4}'::int[], 'Konkan sprint review',                false),
    (171, 103, 314,  4, '{0,1,2,3,4}'::int[], 'SOP translation and handover',        true)
) AS p(ts_n, project_n, task_n, hours, days, descr, billable)
JOIN timesheets t ON t.id = pg_temp.ts(p.ts_n)
JOIN resources r ON r.id = t.resource_id
CROSS JOIN LATERAL unnest(p.days) AS d(offset_days);

UPDATE project_tasks pt
SET actual_hours = COALESCE((
    SELECT sum(e.hours) FROM time_entries e JOIN timesheets t ON t.id = e.timesheet_id
    WHERE e.task_id = pt.id AND e.deleted_at IS NULL AND t.status = 'APPROVED'), 0)
WHERE pt.organization_id = :'org';

UPDATE projects p
SET actual_hours = COALESCE((
    SELECT sum(e.hours) FROM time_entries e JOIN timesheets t ON t.id = e.timesheet_id
    WHERE e.project_id = p.id AND e.deleted_at IS NULL AND t.status = 'APPROVED'), 0)
WHERE p.organization_id = :'org';

-- Approval requests mirror what TimesheetService opens on submit (link submissions are opened by the resource manager).
INSERT INTO approval_requests (id, organization_id, workflow_id, target_type, target_id, status, current_step_id, submitted_by,
                               submitted_at, region_id, created_at, updated_at)
SELECT gen_random_uuid(), :'org', w.id, 'TIMESHEET', t.id,
       CASE t.status WHEN 'SUBMITTED' THEN 'PENDING' ELSE t.status END,
       CASE WHEN t.status = 'SUBMITTED' THEN s.id END,
       COALESCE(CASE WHEN t.entry_source = 'SELF' THEN r.user_id END, r.manager_id, :'rm'::uuid),
       t.submitted_at, t.region_id, t.submitted_at, COALESCE(t.approved_at, t.submitted_at)
FROM timesheets t
JOIN resources r ON r.id = t.resource_id
JOIN approval_workflows w ON w.organization_id = t.organization_id AND w.target_type = 'TIMESHEET'
JOIN approval_steps s ON s.workflow_id = w.id AND s.step_order = 1
WHERE t.organization_id = :'org' AND t.status <> 'DRAFT';

INSERT INTO approval_actions (id, organization_id, request_id, step_id, actor_id, action, comment, created_at)
SELECT gen_random_uuid(), :'org', ar.id, s.id, :'pm',
       CASE t.status WHEN 'APPROVED' THEN 'APPROVE' ELSE 'REJECT' END,
       t.rejection_reason,
       COALESCE(t.approved_at, t.submitted_at + interval '2 days')
FROM approval_requests ar
JOIN timesheets t ON t.id = ar.target_id
JOIN approval_steps s ON s.workflow_id = ar.workflow_id AND s.step_order = 1
WHERE ar.organization_id = :'org' AND t.status IN ('APPROVED', 'REJECTED');

-- ---------------------------------------------------------------------------
-- 7. Finance: tax rates, invoices, payments, credit notes
-- ---------------------------------------------------------------------------
INSERT INTO tax_rates (id, organization_id, code, name, rate_percent, jurisdiction, tax_type, active, description, created_by)
SELECT pg_temp.tx(v.n), :'org', v.code, v.name, v.rate, v.jurisdiction, v.tax_type, true, v.descr, :'fin'
FROM (VALUES
    (1, 'GST18',  'GST 18% (CGST 9% + SGST 9%)', 18, 'Maharashtra (intra-state)', 'OTHER', 'Default for services billed within Maharashtra.'),
    (2, 'CGST9',  'CGST 9%',                     9,  'Maharashtra',               'CGST',  'Central GST component for intra-state supplies.'),
    (3, 'SGST9',  'SGST 9%',                     9,  'Maharashtra',               'SGST',  'State GST component for intra-state supplies.'),
    (4, 'IGST18', 'IGST 18%',                    18, 'Inter-state',               'IGST',  'Services billed to clients outside Maharashtra.'),
    (5, 'IGST12', 'IGST 12%',                    12, 'Inter-state',               'IGST',  'Reduced rate for eligible goods.')
) AS v(n, code, name, rate, jurisdiction, tax_type, descr);

INSERT INTO invoices (id, organization_id, region_id, account_id, project_id, invoice_number, status, currency_code, issue_date, due_date,
                      subtotal, tax_total, total, amount_paid, amount_credited, balance_due, notes, created_by, created_at)
SELECT pg_temp.inv(v.n), :'org', :'pun', pg_temp.u8(v.account_n), pg_temp.u9(v.project_n), v.number, v.status, 'INR',
       v.issued::date, v.due::date, 0, 0, 0, 0, 0, 0, v.notes, :'fin', pg_temp.ist(COALESCE(v.issued, '2026-09-28') || ' 10:00')
FROM (VALUES
    (1,  103, 103, 'INV-00001', 'PAID',           '2026-05-29', '2026-06-28', 'Milestone 1 of 2.'),
    (2,  105, 105, 'INV-00002', 'PAID',           '2026-07-01', '2026-07-31', NULL),
    (3,  104, 104, 'INV-00003', 'PAID',           '2026-07-31', '2026-08-30', 'Time and materials, July 2026.'),
    (4,  105, 105, 'INV-00004', 'OVERDUE',        '2026-08-01', '2026-08-31', 'Reminder sent on 7 Sep and 21 Sep.'),
    (5,  103, 103, 'INV-00005', 'PARTIALLY_PAID', '2026-08-14', '2026-09-13', 'Milestone 2 of 2.'),
    (6,  101, 101, 'INV-00006', 'PAID',           '2026-08-31', '2026-09-30', 'Time and materials, August 2026.'),
    (7,  105, 105, 'INV-00007', 'ISSUED',         '2026-09-01', '2026-10-01', NULL),
    (8,  102, 102, 'INV-00008', 'ISSUED',         '2026-09-15', '2026-10-15', 'Mobilisation advance as per SOW clause 6.'),
    (9,  1,   1,   'INV-00009', 'ISSUED',         '2026-09-20', '2026-10-20', '30% advance on the fixed fee.'),
    (10, 113, 108, NULL,        'DRAFT',          NULL,         NULL,         'To be issued when the pipeline milestone is accepted.')
) AS v(n, account_n, project_n, number, status, issued, due, notes);

INSERT INTO invoice_lines (id, organization_id, invoice_id, line_no, description, quantity, unit_price, amount, tax_rate_id, tax_amount, project_id)
SELECT gen_random_uuid(), :'org', i.id, v.line_no, v.descr, v.qty, v.price, v.qty * v.price, tr.id,
       round(v.qty * v.price * tr.rate_percent / 100, 2), i.project_id
FROM (VALUES
    (1,  1, 'Milestone 1 - Pilot line go-live (line 3)',       1,   475000, 1),
    (2,  1, 'Monthly retainer - July 2026',                    1,   150000, 4),
    (3,  1, 'Discovery and video-KYC prototype - Arjun Nair',  120, 2500,   1),
    (3,  2, 'Delivery management - Asha Kulkarni',             16,  3500,   1),
    (4,  1, 'Monthly retainer - August 2026',                  1,   150000, 4),
    (5,  1, 'Milestone 2 - Plant-wide rollout and SOPs',       1,   475000, 1),
    (6,  1, 'Integration lead - Rohan Mehta (Aug 2026)',       168, 3200,   1),
    (6,  2, 'Backend engineering - Arjun Nair (Aug 2026)',     64,  2500,   1),
    (6,  3, 'Delivery management - Meera Iyer (Aug 2026)',     32,  3500,   1),
    (7,  1, 'Monthly retainer - September 2026',               1,   150000, 4),
    (8,  1, 'Mobilisation advance (20% of contract value)',    1,   480000, 1),
    (9,  1, 'Advance - 30% of fixed fee',                      1,   75000,  1),
    (10, 1, 'Milestone 1 - Sensor data pipeline (25%)',        1,   662500, 4)
) AS v(inv_n, line_no, descr, qty, price, tax_n)
JOIN invoices i ON i.id = pg_temp.inv(v.inv_n)
JOIN tax_rates tr ON tr.id = pg_temp.tx(v.tax_n);

INSERT INTO invoice_payments (id, organization_id, invoice_id, amount, paid_at, method, reference, notes, created_by)
SELECT gen_random_uuid(), :'org', pg_temp.inv(v.inv_n), v.amount, v.paid::date, v.method, v.reference, v.notes, :'fin'
FROM (VALUES
    (1, 560500, '2026-06-20', 'NEFT', 'UTR HDFCN26171845530',   NULL),
    (2, 177000, '2026-07-28', 'RTGS', 'UTR ICICR52026072800141', NULL),
    (3, 420080, '2026-08-27', 'NEFT', 'UTR SBINN26239011872',   NULL),
    (5, 300000, '2026-09-10', 'NEFT', 'UTR HDFCN26253300917',   'Part payment; balance promised by 15 Oct.'),
    (6, 955328, '2026-09-18', 'RTGS', 'UTR KKBKR52026091800562', NULL)
) AS v(inv_n, amount, paid, method, reference, notes);

INSERT INTO credit_notes (id, organization_id, invoice_id, credit_number, status, amount, reason, issue_date, created_by)
VALUES (gen_random_uuid(), :'org', pg_temp.inv(4), 'CN-00001', 'ISSUED', 11800,
        'Service credit for 2 days of portal downtime (SLA clause 4.2).', DATE '2026-09-05', :'fin');

UPDATE invoices i
SET subtotal = s.subtotal, tax_total = s.tax_total, total = s.subtotal + s.tax_total
FROM (SELECT invoice_id, sum(amount) AS subtotal, sum(tax_amount) AS tax_total FROM invoice_lines GROUP BY invoice_id) s
WHERE s.invoice_id = i.id;

UPDATE invoices i
SET amount_paid     = COALESCE((SELECT sum(amount) FROM invoice_payments p WHERE p.invoice_id = i.id AND p.deleted_at IS NULL), 0),
    amount_credited = COALESCE((SELECT sum(amount) FROM credit_notes c WHERE c.invoice_id = i.id AND c.status IN ('ISSUED', 'APPLIED') AND c.deleted_at IS NULL), 0);

UPDATE invoices SET balance_due = total - amount_paid - amount_credited;

INSERT INTO invoice_number_sequences (id, organization_id, prefix, next_value, pad_width) VALUES
    (gen_random_uuid(), :'org', 'INV', 10, 5),
    (gen_random_uuid(), :'org', 'CN', 2, 5);

-- ---------------------------------------------------------------------------
-- 8. Procurement and expenses
-- ---------------------------------------------------------------------------
INSERT INTO vendors (id, organization_id, region_id, name, email, phone, tax_number, account_id, payment_terms_days, status, notes, created_by)
SELECT pg_temp.ven(v.n), :'org', v.region::uuid, v.name, v.email, v.phone, v.gstin,
       CASE WHEN v.account_n IS NOT NULL THEN pg_temp.u8(v.account_n) END, v.terms, v.status, v.notes, :'fin'
FROM (VALUES
    (1, :'pun', 'Printwell Office Supplies',      'orders@printwell.example.com',       '+91-20-2553-4418', '27ABUPS4120K1ZN', 115,  30, 'ACTIVE',   'Monthly stationery; delivers within 2 days.'),
    (2, :'mum', 'Bluepeak Cloud Hosting Pvt Ltd', 'billing@bluepeak-cloud.example.com', '+91-22-6172-9900', '27AAICB6604A1ZS', 116,  45, 'ACTIVE',   'Managed Kubernetes and PostgreSQL hosting.'),
    (3, :'pun', 'Shree Ganesh Travels',           'desk@shreeganesh-travels.example.com', '+91-20-2444-6710', '27AAPFS2231H1ZC', 117, 15, 'ACTIVE',   'Corporate travel desk.'),
    (4, :'pun', 'Techno Hardware Solutions',      'sales@technohardware.example.com',   '+91-20-2612-3390', '27AAGFT8830L1ZV', NULL, 30, 'ACTIVE',   'Laptops, test devices and accessories.'),
    (5, :'blr', 'Nexus Coworking Spaces',         'accounts@nexuscowork.example.com',   '+91-80-4960-1122', '29AAFCN4471K1ZA', NULL, 30, 'INACTIVE', 'Bengaluru hot desks; contract ended in June 2026.')
) AS v(n, region, name, email, phone, gstin, account_n, terms, status, notes);

INSERT INTO purchase_orders (id, organization_id, region_id, vendor_id, project_id, requester_id, po_number, status, currency_code,
                             subtotal, tax_total, total, needed_by, approved_at, approved_by, notes, created_by, created_at)
SELECT pg_temp.po(v.n), :'org', :'pun', pg_temp.ven(v.vendor_n),
       CASE WHEN v.project_n IS NOT NULL THEN pg_temp.u9(v.project_n) END,
       v.requester::uuid, v.number, v.status, 'INR', 0, 0, 0, v.needed::date,
       CASE WHEN v.status IN ('APPROVED', 'SENT', 'CLOSED') THEN pg_temp.ist(v.created) + interval '1 day' END,
       CASE WHEN v.status IN ('APPROVED', 'SENT', 'CLOSED') THEN :'fin'::uuid END,
       v.notes, v.requester::uuid, pg_temp.ist(v.created)
FROM (VALUES
    (1, 2, 102,  :'pm', 'PO-2026-001', 'APPROVED',         '2026-09-01', 'Hosting for the Konkan GPS ingestion platform, Sep-Dec.', '2026-08-24 11:00'),
    (2, 4, 102,  :'pm', 'PO-2026-002', 'SENT',             '2026-09-10', 'Test devices for the Konkan driver app.',                '2026-08-28 15:30'),
    (3, 1, NULL, :'rm', 'PO-2026-003', 'PENDING_APPROVAL', '2026-10-05', 'Q4 office stationery for Pune HQ.',                      '2026-09-25 10:15'),
    (4, 3, 106,  :'pm', 'PO-2026-004', 'DRAFT',            '2026-10-10', 'Travel for the Yamuna kick-off in Delhi.',               '2026-09-28 16:40'),
    (5, 2, 105,  :'pm', 'PO-2026-005', 'CLOSED',           '2026-07-06', 'Staging environment for the Nandi Hills portal.',        '2026-06-29 12:00')
) AS v(n, vendor_n, project_n, requester, number, status, needed, notes, created);

INSERT INTO purchase_order_items (id, organization_id, purchase_order_id, line_no, description, quantity, unit_price, amount, tax_rate_id,
                                  tax_amount, received_qty)
SELECT gen_random_uuid(), :'org', pg_temp.po(v.po_n), v.line_no, v.descr, v.qty, v.price, v.qty * v.price, pg_temp.tx(v.tax_n),
       round(v.qty * v.price * tr.rate_percent / 100, 2), v.received
FROM (VALUES
    (1, 1, 'Managed Kubernetes cluster (monthly)',      4,  42000, 1, 1),
    (1, 2, 'Managed PostgreSQL, 500 GB (monthly)',      4,  18000, 1, 1),
    (2, 1, 'Android test phones (Samsung Galaxy A35)',  6,  28500, 1, 0),
    (2, 2, 'Rugged 8-inch tablets',                     2,  46000, 1, 0),
    (3, 1, 'A4 copier paper (ream)',                    40, 260,   1, 0),
    (3, 2, 'Whiteboard markers (box of 10)',            10, 450,   1, 0),
    (3, 3, 'Spiral notebooks',                          50, 120,   1, 0),
    (4, 1, 'Pune-Delhi return flights',                 3,  14500, 5, 0),
    (4, 2, 'Hotel, Nehru Place (per room-night)',       6,  5200,  1, 0),
    (5, 1, 'Staging VM cluster (monthly)',              3,  16500, 1, 3)
) AS v(po_n, line_no, descr, qty, price, tax_n, received)
JOIN tax_rates tr ON tr.id = pg_temp.tx(v.tax_n);

UPDATE purchase_orders po
SET subtotal = s.subtotal, tax_total = s.tax_total, total = s.subtotal + s.tax_total
FROM (SELECT purchase_order_id, sum(amount) AS subtotal, sum(tax_amount) AS tax_total FROM purchase_order_items GROUP BY purchase_order_id) s
WHERE s.purchase_order_id = po.id;

INSERT INTO expenses (id, organization_id, region_id, resource_id, project_id, category, description, amount, currency_code, expense_date,
                      billable, status, submitted_at, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, created_by)
SELECT gen_random_uuid(), :'org', r.region_id, r.id, CASE WHEN v.project_n IS NOT NULL THEN pg_temp.u9(v.project_n) END,
       v.category, v.descr, v.amount, 'INR', v.spent::date, v.billable, v.status,
       CASE WHEN v.status <> 'DRAFT' THEN pg_temp.ist(v.spent || ' 19:00') END,
       CASE WHEN v.status = 'APPROVED' THEN pg_temp.ist(v.spent || ' 12:00') + interval '3 days' END,
       CASE WHEN v.status = 'APPROVED' THEN :'pm'::uuid END,
       CASE WHEN v.status = 'REJECTED' THEN pg_temp.ist(v.spent || ' 12:00') + interval '2 days' END,
       CASE WHEN v.status = 'REJECTED' THEN :'fin'::uuid END,
       v.reason, COALESCE(r.user_id, r.manager_id)
FROM (VALUES
    (1,  101,  'Travel',   'Cab to Sahyadri, Hadapsar for the requirements workshop', 640,   '2026-08-05', true,  'APPROVED',  NULL),
    (2,  102,  'Travel',   'Pune-Mumbai return by Deccan Queen for the Konkan kick-off', 1180, '2026-08-18', true, 'APPROVED', NULL),
    (2,  102,  'Lodging',  'Hotel in Andheri East for the Konkan kick-off (1 night)', 6800,  '2026-08-18', true,  'APPROVED',  NULL),
    (11, 101,  'Meals',    'Working lunch with the Sahyadri IT team during cutover planning', 2350, '2026-09-11', true, 'SUBMITTED', NULL),
    (13, NULL, 'Software', 'JetBrains All Products licence (annual)',                24900, '2026-08-12', false, 'REJECTED',  'Covered by the company licence pool - please raise an IT request.'),
    (21, 1,    'Software', 'Figma Professional seat (3 months)',                     3600,  '2026-09-02', true,  'SUBMITTED', NULL),
    (22, 102,  'Supplies', 'USB-C debugging cables and hub',                         1850,  '2026-09-09', false, 'DRAFT',     NULL),
    (12, 105,  'Travel',   'Cab to Nandi Hills, Whitefield for UAT',                 780,   '2026-09-17', true,  'SUBMITTED', NULL),
    (1,  1,    'Meals',    'Discovery workshop snacks at Horizon HQ',                1450,  '2026-09-16', true,  'APPROVED',  NULL)
) AS v(resource_n, project_n, category, descr, amount, spent, billable, status, reason)
JOIN resources r ON r.id = pg_temp.rs(v.resource_n);

-- ---------------------------------------------------------------------------
-- 9. Contracts
-- ---------------------------------------------------------------------------
INSERT INTO contracts (id, organization_id, region_id, account_id, project_id, name, contract_number, status, value_amount, currency_code,
                       start_date, end_date, auto_renew, renewal_notice_days, terms, owner_id, created_by)
SELECT gen_random_uuid(), :'org', a.region_id, a.id, CASE WHEN v.project_n IS NOT NULL THEN pg_temp.u9(v.project_n) END,
       v.name, v.number, v.status, v.value, 'INR', v.start_date::date, v.end_date::date, v.auto_renew, v.notice, v.terms, a.owner_id, :'admin'
FROM (VALUES
    (103, 103, 'Shop-floor dashboard - fixed price SOW', 'CTR-2026-001', 'EXPIRED',    950000,  '2026-04-01', '2026-08-31', false, 30, 'Two milestones of 50% each. 90-day warranty.'),
    (109, 107, 'Booking engine SOW',                     'CTR-2026-002', 'TERMINATED', 780000,  '2026-05-20', '2026-12-31', false, 30, 'Terminated by mutual consent on 14 Aug 2026.'),
    (104, 104, 'Client onboarding app - T&M agreement',  'CTR-2026-003', 'ACTIVE',     1350000, '2026-06-15', '2026-12-31', false, 30, 'Monthly T&M billing, net 30.'),
    (105, 105, 'Patient portal annual retainer',         'CTR-2026-004', 'ACTIVE',     1800000, '2026-07-01', '2027-06-30', true,  45, 'INR 1.5 lakh per month; SLA 99.5% uptime.'),
    (101, 101, 'Master services agreement',              'CTR-2026-005', 'ACTIVE',     1850000, '2026-08-01', '2027-07-31', false, 60, 'Hourly billing at agreed rate card, net 30.'),
    (113, 108, 'Solar monitoring MSA',                   'CTR-2026-006', 'ACTIVE',     2650000, '2026-08-10', '2027-03-31', false, 60, 'Four milestones of 25% each.'),
    (102, 102, 'Fleet tracking platform SOW',            'CTR-2026-007', 'ACTIVE',     2400000, '2026-08-15', '2027-02-28', false, 45, '20% advance, then milestone billing.'),
    (1,   1,   'Storefront redesign SOW',                'CTR-2026-008', 'ACTIVE',     250000,  '2026-09-15', '2026-12-31', false, 30, '30% advance, 40% on build, 30% on launch.'),
    (107, 106, 'Site inspection app SOW',                'CTR-2026-009', 'DRAFT',      1100000, '2026-10-12', '2027-03-31', false, 30, 'Awaiting client legal review.')
) AS v(account_n, project_n, name, number, status, value, start_date, end_date, auto_renew, notice, terms)
JOIN accounts a ON a.id = pg_temp.u8(v.account_n);

-- ---------------------------------------------------------------------------
-- 10. Activities, notes, notifications, audit trail, saved views, prospects
-- ---------------------------------------------------------------------------
INSERT INTO activities (organization_id, region_id, type, subject, description, status, priority, due_date, assigned_to,
                        related_entity_type, related_entity_id, completed_at, location, outcome, call_direction, duration_seconds, created_by)
SELECT :'org', v.region::uuid, v.type, v.subject, v.descr, v.status, v.priority, pg_temp.ist(v.due), v.assignee::uuid,
       v.entity_type, pg_temp.u8(v.entity_n), CASE WHEN v.status = 'COMPLETED' THEN pg_temp.ist(v.due) END,
       v.location, v.outcome, v.direction, v.duration, v.assignee::uuid
FROM (VALUES
    (:'pun', 'NOTE',      'Lead converted',                         'Converted to account, contact, and won deal.',               'COMPLETED', NULL,     '2026-09-10 10:00', :'sales', 'LEAD',    21,  NULL,                      NULL,        NULL,       NULL),
    (:'mum', 'CALL',      'Intro call with Kunal Shah',             'Understand catalogue size and store-pickup needs.',          'OPEN',      'MEDIUM', '2026-10-01 11:30', :'sales', 'LEAD',    301, NULL,                      NULL,        'OUTBOUND', NULL),
    (:'del', 'MEETING',   'Demo for Chopra Diagnostics',            'Show the report portal prototype and WhatsApp flow.',        'OPEN',      'HIGH',   '2026-10-03 15:00', :'smgr',  'LEAD',    302, 'Google Meet',             NULL,        NULL,       NULL),
    (:'pun', 'MEETING',   'Plant visit - Patil Auto Components',    'Walk through both lines with Prakash Patil.',               'COMPLETED', 'HIGH',   '2026-09-18 10:00', :'sales', 'LEAD',    303, 'Bhosari MIDC, Pune',      'Qualified', NULL,       NULL),
    (:'del', 'CALL',      'Pricing follow-up with Abhishek Agarwal', 'Discussed a phased rollout to bring the first phase under 6 lakh.', 'COMPLETED', 'HIGH', '2026-09-23 12:00', :'smgr', 'LEAD',   305, NULL,                      'Positive',  'OUTBOUND', 1260),
    (:'pun', 'FOLLOW_UP', 'Send proposal to Aditi Organics',        'Proposal for D2C storefront with subscriptions.',            'OPEN',      'MEDIUM', '2026-10-02 18:00', :'sales', 'LEAD',    309, NULL,                      NULL,        NULL,       NULL),
    (:'hyd', 'MEETING',   'Negotiation - Charminar QMS',            'Commercials and implementation timeline with Venkat Reddy.', 'OPEN',      'HIGH',   '2026-10-06 11:00', :'smgr',  'DEAL',    409, 'Charminar HQ, Genome Valley', NULL,     NULL,       NULL),
    (:'ggn', 'TASK',      'Revise Aravali proposal',                'Add a parent-app phase and revised timeline.',               'OPEN',      'MEDIUM', '2026-10-04 17:00', :'smgr',  'DEAL',    410, NULL,                      NULL,        NULL,       NULL),
    (:'mum', 'MEETING',   'Requirements workshop - Indus Fintech',  'KYC and underwriting workflow deep dive.',                   'OPEN',      'HIGH',   '2026-10-08 10:30', :'sales', 'DEAL',    411, 'Indus office, BKC',       NULL,        NULL,       NULL),
    (:'pun', 'CALL',      'Loyalty app discovery with Rohit Malhotra', 'Scope phase 2 loyalty features.',                         'COMPLETED', 'MEDIUM', '2026-09-24 16:00', :'sales', 'DEAL',    412, NULL,                      'Interested', 'OUTBOUND', 1840),
    (:'mum', 'CALL',      'Konkan warehouse app - commercials',     'Pooja asked for a volume discount on 3 warehouses.',         'COMPLETED', 'HIGH',   '2026-09-26 12:30', :'sales', 'DEAL',    416, NULL,                      'Negotiating', 'INBOUND', 960),
    (:'del', 'NOTE',      'Lost to packaged SaaS',                  'Lotus chose a packaged insurance CRM on price.',             'COMPLETED', NULL,     '2026-08-30 12:00', :'smgr',  'DEAL',    414, NULL,                      'Lost',      NULL,       NULL),
    (:'blr', 'FOLLOW_UP', 'Collect overdue retainer - Nandi Hills', 'August retainer is overdue; follow up with Suresh Gowda.',   'OPEN',      'HIGH',   '2026-10-01 11:00', :'smgr',  'ACCOUNT', 105, NULL,                      NULL,        NULL,       NULL),
    (:'pun', 'MEETING',   'Quarterly review - Sahyadri Agro',       'Progress review with Sunil Pawar and Deepa Jadhav.',         'OPEN',      'MEDIUM', '2026-10-09 15:00', :'sales', 'ACCOUNT', 101, 'Sahyadri office, Hadapsar', NULL,       NULL,       NULL),
    (:'blr', 'CALL',      'Partner sync - Cloudnine',               'Pipeline review of co-sell opportunities.',                  'COMPLETED', 'LOW',    '2026-09-19 17:00', :'smgr',  'ACCOUNT', 111, NULL,                      'Two new leads', 'OUTBOUND', 1500),
    (:'pun', 'CALL',      'Check-in with Deepa Jadhav',             'Confirm QA SAP B1 company database refresh.',                'COMPLETED', 'LOW',    '2026-09-09 11:00', :'pm',    'CONTACT', 203, NULL,                      'Confirmed', 'OUTBOUND', 540)
) AS v(region, type, subject, descr, status, priority, due, assignee, entity_type, entity_n, location, outcome, direction, duration);

INSERT INTO activities (organization_id, region_id, type, subject, description, status, priority, due_date, assigned_to,
                        related_entity_type, related_entity_id, completed_at, created_by)
SELECT :'org', :'pun', v.type, v.subject, v.descr, v.status, v.priority, pg_temp.ist(v.due), v.assignee::uuid,
       'PROJECT', pg_temp.u9(v.project_n), CASE WHEN v.status = 'COMPLETED' THEN pg_temp.ist(v.due) END, v.assignee::uuid
FROM (VALUES
    ('FOLLOW_UP', 'Kickoff with Horizon',              'Schedule project kickoff with Priya Sharma.',             'OPEN',      'HIGH',   '2026-09-16 10:00', :'pm',    1),
    ('MEETING',   'Konkan sprint 3 review',            'Demo trip tracking to Imran Shaikh.',                     'OPEN',      'MEDIUM', '2026-10-02 16:00', :'pm',    102),
    ('MEETING',   'Godavari pipeline design review',   'Review MQTT topic map and storage design.',               'COMPLETED', 'HIGH',   '2026-09-15 14:00', :'pm',    108),
    ('TASK',      'Confirm Yamuna kick-off date',      'Align site-visit dates with Amit Chauhan.',               'OPEN',      'MEDIUM', '2026-10-05 12:00', :'pm',    106),
    ('NOTE',      'Deccan project closed',             'All deliverables accepted; warranty runs to 12 Nov 2026.', 'COMPLETED', NULL,    '2026-08-14 17:00', :'pm',    103)
) AS v(type, subject, descr, status, priority, due, assignee, project_n);

INSERT INTO notes (organization_id, entity_type, entity_id, body, created_by, created_at)
SELECT :'org', v.entity_type, v.entity_id, v.body, v.author::uuid, pg_temp.ist(v.at)
FROM (VALUES
    ('ACCOUNT',   pg_temp.u8(1),   'Priya prefers updates over email every Friday; escalations go to Rohit.',                  :'sales', '2026-09-16 12:00'),
    ('ACCOUNT',   pg_temp.u8(105), 'Accounts payable runs on the 5th and 20th. Invoices need a PO reference.',                :'fin',   '2026-08-02 11:00'),
    ('DEAL',      pg_temp.u8(409), 'Venkat wants a 21 CFR Part 11 compliance statement before signing.',                     :'smgr',  '2026-09-20 15:30'),
    ('LEAD',      pg_temp.u8(305), 'Decision maker is Abhishek; his CFO joins the next call.',                               :'smgr',  '2026-09-23 12:30'),
    ('PROJECT',   pg_temp.u9(101), 'Change request CR-02 approved: invoice sync added to scope (+120 h).',                   :'pm',    '2026-09-04 10:00'),
    ('PROJECT',   pg_temp.u9(104), 'Paused on 14 Aug at the client''s request pending their compliance review.',              :'admin', '2026-08-14 16:00'),
    ('RESOURCE',  pg_temp.rs(11),  'Contract extended to March 2027; rate revised to INR 3,200/h from 1 Aug.',               :'rm',    '2026-07-28 10:00'),
    ('RESOURCE',  pg_temp.rs(23),  'Engagement ended 31 Aug after the Deccan handover. Eligible for rehire.',                :'rm',    '2026-09-01 09:30'),
    ('TIMESHEET', pg_temp.ts(151), 'Farhan to resubmit with separate lines for trip tracking and proof of delivery.',        :'pm',    '2026-09-14 11:00')
) AS v(entity_type, entity_id, body, author, at);

INSERT INTO notifications (organization_id, user_id, type, title, message, entity_type, entity_id, read, created_at)
SELECT :'org', v.recipient::uuid, v.type, v.title, v.message, v.entity_type, v.entity_id, v.is_read, pg_temp.ist(v.at)
FROM (VALUES
    (:'sales', 'LEAD_ASSIGNED',       'Lead assigned',       'Horizon Retail enquiry was assigned to you.',                    'LEAD',      pg_temp.u8(21),  true,  '2026-08-28 10:30'),
    (:'sales', 'LEAD_ASSIGNED',       'Lead assigned',       'Kunal Shah (Shah Jewellers and Sons) was assigned to you.',      'LEAD',      pg_temp.u8(301), false, '2026-09-24 11:20'),
    (:'sales', 'LEAD_ASSIGNED',       'Lead assigned',       'Rashmi Apte (Apte Architects) was assigned to you.',             'LEAD',      pg_temp.u8(315), false, '2026-09-29 09:20'),
    (:'smgr',  'DEAL_WON',            'Deal won',            'Yamuna site inspection app was marked as won.',                  'DEAL',      pg_temp.u8(406), true,  '2026-09-22 12:00'),
    (:'pm',    'DEAL_WON',            'New project',         'Yamuna site inspection app is ready for kick-off planning.',     'PROJECT',   pg_temp.u9(106), false, '2026-09-22 12:05'),
    (:'pm',    'TIMESHEET_SUBMITTED', 'Timesheet submitted', 'Arjun Nair submitted the week of 14 Sep 2026.',                  'TIMESHEET', pg_temp.ts(1),   false, '2026-09-18 23:30'),
    (:'pm',    'TIMESHEET_SUBMITTED', 'Timesheet submitted', 'Arjun Nair submitted the week of 21 Sep 2026.',                  'TIMESHEET', pg_temp.ts(103), false, '2026-09-25 18:00'),
    (:'pm',    'TIMESHEET_SUBMITTED', 'Timesheet submitted', 'Rohan Mehta submitted the week of 21 Sep 2026 through a secure link.', 'TIMESHEET', pg_temp.ts(114), false, '2026-09-25 18:10'),
    (:'pm',    'TIMESHEET_SUBMITTED', 'Timesheet submitted', 'Aditya Verma submitted the week of 21 Sep 2026 through a secure link.', 'TIMESHEET', pg_temp.ts(132), false, '2026-09-25 19:05'),
    (:'pm',    'TIMESHEET_SUBMITTED', 'Timesheet submitted', 'Kavya Menon submitted the week of 21 Sep 2026 through a secure link.', 'TIMESHEET', pg_temp.ts(142), false, '2026-09-25 20:15'),
    (:'admin', 'TIMESHEET_SUBMITTED', 'Timesheet submitted', 'Meera Iyer submitted the week of 21 Sep 2026.',                  'TIMESHEET', pg_temp.ts(161), false, '2026-09-25 18:30'),
    (:'emp',   'TIMESHEET_APPROVED',  'Timesheet approved',  'Your timesheet for the week of 7 Sep 2026 was approved.',        'TIMESHEET', pg_temp.ts(102), true,  '2026-09-14 11:00'),
    (:'emp',   'TIMESHEET_APPROVED',  'Timesheet approved',  'Your timesheet for the week of 31 Aug 2026 was approved.',       'TIMESHEET', pg_temp.ts(101), true,  '2026-09-07 11:00'),
    (:'rm',    'TIMESHEET_REJECTED',  'Timesheet rejected',  'Farhan Qureshi''s week of 7 Sep 2026 was rejected: Please split the hours between trip tracking and proof-of-delivery.', 'TIMESHEET', pg_temp.ts(151), false, '2026-09-13 11:00')
) AS v(recipient, type, title, message, entity_type, entity_id, is_read, at);

INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
SELECT :'org', v.actor::uuid, v.action, v.entity_type, v.entity_id, v.payload::jsonb, pg_temp.ist(v.at)
FROM (VALUES
    (:'sales', 'CONVERT', 'LEAD',      pg_temp.u8(21),  '{"accountId":"88888888-8888-4888-8888-000000000001","dealId":"88888888-8888-4888-8888-000000000031"}', '2026-09-10 15:30'),
    (:'smgr',  'UPDATE',  'DEAL',      pg_temp.u8(406), '{"stage":"WON"}',                                        '2026-09-22 12:00'),
    (:'pm',    'CREATE',  'PROJECT',   pg_temp.u9(106), '{"projectCode":"YIP-INS-001","status":"PLANNED"}',       '2026-09-22 12:10'),
    (:'rm',    'CREATE',  'RESOURCE',  pg_temp.rs(22),  '{"employeeCode":"FRL-002","resourceType":"FREELANCER"}', '2026-08-14 10:00'),
    (:'emp',   'CREATE',  'TIMESHEET', pg_temp.ts(1),   '{"status":"SUBMITTED","weekStartDate":"2026-09-14"}',    '2026-09-18 23:30'),
    (:'pm',    'APPROVE', 'TIMESHEET', pg_temp.ts(113), '{"status":"APPROVED"}',                                  '2026-09-21 11:00'),
    (:'pm',    'REJECT',  'TIMESHEET', pg_temp.ts(151), '{"status":"REJECTED"}',                                  '2026-09-13 11:00'),
    (:'fin',   'UPDATE',  'INVOICE',   pg_temp.inv(6),  '{"status":"PAID"}',                                      '2026-09-18 16:00')
) AS v(actor, action, entity_type, entity_id, payload, at);

INSERT INTO saved_views (organization_id, owner_id, module, name, visibility, filter_json, is_default)
SELECT :'org', v.owner::uuid, v.module, v.name, v.visibility, v.filter::jsonb, false
FROM (VALUES
    (:'sales', 'LEAD',      'Hot leads',                'PRIVATE', '{"op":"AND","conditions":[{"field":"priority","value":"HIGH","operator":"EQ"}]}'),
    (:'smgr',  'DEAL',      'Deals in negotiation',     'SHARED',  '{"op":"AND","conditions":[{"field":"stage","value":"NEGOTIATION","operator":"EQ"}]}'),
    (:'pm',    'PROJECT',   'Active projects',          'SHARED',  '{"op":"AND","conditions":[{"field":"status","value":"ACTIVE","operator":"EQ"}]}'),
    (:'pm',    'TIMESHEET', 'Waiting for approval',     'PRIVATE', '{"op":"AND","conditions":[{"field":"status","value":"SUBMITTED","operator":"EQ"}]}'),
    (:'fin',   'INVOICE',   'Overdue invoices',         'SHARED',  '{"op":"AND","conditions":[{"field":"status","value":"OVERDUE","operator":"EQ"}]}')
) AS v(owner, module, name, visibility, filter)
ON CONFLICT DO NOTHING;

INSERT INTO platform_prospect_orgs (id, name, legal_name, website, email, phone, source, stage, estimated_arr, owner_user_id, notes, created_by)
SELECT gen_random_uuid(), v.name, v.legal, 'https://' || v.domain, 'hello@' || v.domain, v.phone, v.source, v.stage, v.arr, :'sup', v.notes, :'sup'
FROM (VALUES
    ('Pinnacle Realty Group',   'Pinnacle Realty Group Pvt Ltd',   'pinnaclerealty.example.com',   '+91-22-6120-4455', 'Website',  'QUALIFIED', 480000, 'Wants CRM plus site-visit scheduling for 40 sales staff.'),
    ('Shakti Motors',           'Shakti Motors Pvt Ltd',           'shaktimotors.example.com',     '+91-20-2745-1180', 'Referral', 'NEW',       300000, 'Dealer group with 6 showrooms in Pune.'),
    ('Sunrise Diagnostics',     'Sunrise Diagnostics LLP',         'sunrisediagnostics.example.com', '+91-80-4099-2201', 'Event',  'PROPOSAL',  650000, 'Evaluating us against two SaaS CRMs; decision in November.'),
    ('Greenfield Agritech',     'Greenfield Agritech Pvt Ltd',     'greenfieldagri.example.com',   '+91-40-2988-7710', 'Website',  'NEW',       220000, 'Farmer-network startup; early conversations.'),
    ('BrightPath Schools Trust', 'BrightPath Educational Trust',   'brightpathschools.example.com', '+91-11-4388-5520', 'Referral', 'LOST',     180000, 'Chose a school ERP with a bundled CRM.')
) AS v(name, legal, domain, phone, source, stage, arr, notes);

COMMIT;
