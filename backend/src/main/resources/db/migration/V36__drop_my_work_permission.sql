DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'MY_WORK_VIEW');

DELETE FROM permissions WHERE code = 'MY_WORK_VIEW';
