-- Audit actions recorded by portal invitations and emailed timesheet links (V34).
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_chk;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_chk CHECK (action IN (
    'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'ASSIGN', 'CONVERT',
    'LOGIN', 'LOGOUT', 'EXECUTE',
    'PORTAL_INVITE', 'PORTAL_ACCESS', 'PORTAL_REVOKE', 'ACCEPT_INVITE',
    'ISSUE_LINK', 'SUBMIT_VIA_LINK'
));
