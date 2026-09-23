# Batch 11 QA — List prefs, Form policies, Related lists, Table ACL

**Stories:** US-S9-004, US-S9-005, US-S9-006, US-S10-001, US-S10-002  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Leads list | Columns match published list layout (Studio seed) | |
| 2 | Leads → Columns chooser | Personal selection persists; Reset restores admin default | |
| 3 | Leads → Export | CSV headers match currently visible columns | |
| 4 | Deal → stage LOST without reason | Client blocks; server returns 422 POLICY_MANDATORY | |
| 5 | Account RecordShell → Related | Contacts/Deals/Activities from published related-list layout | |
| 6 | Setup → Table ACL | Role × Table × CRUD matrix; Org Admin can toggle; audited | |
| 7 | Employee POST /leads | 403 (ACL create denied) | |
| 8 | Sales Exec GET /leads | 200 (ACL read allowed) | |

## Automated

- `TableAclEvaluatorTest`
- `MetadataStudioPermissionTest` (prior)

## Components

- `V20__list_prefs_policies_related_acl.sql`
- `TableAclEvaluator` / `FormPolicyEvaluator`
- `AclMatrixPage` (`/admin/acl-matrix`)
- Lead list prefs + export columns
- Account related lists runtime API
