-- ACL Studio (UPSERT), Metadata Studio layouts/policies (SAVE_DRAFT, DISCARD_DRAFT, PUBLISH) and
-- platform prospect linking (LINK) were rejected by the check constraint, failing the whole save.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_chk;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_chk CHECK (action IN (
    'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'ASSIGN', 'CONVERT',
    'LOGIN', 'LOGOUT', 'EXECUTE',
    'PORTAL_INVITE', 'PORTAL_ACCESS', 'PORTAL_REVOKE', 'ACCEPT_INVITE',
    'ISSUE_LINK', 'SUBMIT_VIA_LINK',
    'DEACTIVATE', 'REACTIVATE', 'END',
    'UPSERT', 'SAVE_DRAFT', 'DISCARD_DRAFT', 'PUBLISH', 'LINK'
));
