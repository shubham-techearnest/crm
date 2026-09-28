-- Register extended lead fields in metadata dictionary for layout editor

INSERT INTO sys_field (id, organization_id, table_id, code, label, help_text, field_type, mandatory, reference_table_code, active, is_system, sort_order)
SELECT v.id, NULL, 'c1000001-0000-4000-8000-000000000001', v.code, v.label, NULL, v.ftype, FALSE, NULL, TRUE, TRUE, v.sort
FROM (VALUES
    ('c2000001-0000-4000-8000-000000000120'::uuid, 'salutation', 'Salutation', 'STRING', 18),
    ('c2000001-0000-4000-8000-000000000121'::uuid, 'mobile', 'Mobile', 'STRING', 56),
    ('c2000001-0000-4000-8000-000000000122'::uuid, 'fax', 'Fax', 'STRING', 57),
    ('c2000001-0000-4000-8000-000000000123'::uuid, 'emailOptOut', 'Email opt out', 'BOOLEAN', 71),
    ('c2000001-0000-4000-8000-000000000124'::uuid, 'noOfEmployees', 'No. of employees', 'NUMBER', 72),
    ('c2000001-0000-4000-8000-000000000125'::uuid, 'rating', 'Rating', 'STRING', 73),
    ('c2000001-0000-4000-8000-000000000126'::uuid, 'skypeId', 'Skype ID', 'STRING', 74),
    ('c2000001-0000-4000-8000-000000000127'::uuid, 'secondaryEmail', 'Secondary email', 'STRING', 46),
    ('c2000001-0000-4000-8000-000000000128'::uuid, 'twitter', 'Twitter', 'STRING', 76),
    ('c2000001-0000-4000-8000-000000000129'::uuid, 'addressCountry', 'Country / region', 'STRING', 100),
    ('c2000001-0000-4000-8000-00000000012a'::uuid, 'addressFlat', 'Flat / house no.', 'STRING', 101),
    ('c2000001-0000-4000-8000-00000000012b'::uuid, 'addressStreet', 'Street address', 'STRING', 102),
    ('c2000001-0000-4000-8000-00000000012c'::uuid, 'addressCity', 'City', 'STRING', 103),
    ('c2000001-0000-4000-8000-00000000012d'::uuid, 'addressState', 'State / province', 'STRING', 104),
    ('c2000001-0000-4000-8000-00000000012e'::uuid, 'addressZip', 'Zip / postal code', 'STRING', 105),
    ('c2000001-0000-4000-8000-00000000012f'::uuid, 'addressLatitude', 'Latitude', 'NUMBER', 106),
    ('c2000001-0000-4000-8000-000000000130'::uuid, 'addressLongitude', 'Longitude', 'NUMBER', 107),
    ('c2000001-0000-4000-8000-000000000131'::uuid, 'photoDocumentId', 'Photo', 'REFERENCE', 3)
) AS v(id, code, label, ftype, sort)
WHERE NOT EXISTS (
    SELECT 1 FROM sys_field f
    WHERE f.table_id = 'c1000001-0000-4000-8000-000000000001' AND f.code = v.code AND f.organization_id IS NULL
);
