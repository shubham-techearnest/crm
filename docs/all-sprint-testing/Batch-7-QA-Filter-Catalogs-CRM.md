# Batch 7 QA — Advanced filter catalogs (Contacts → Documents)

**Stories:** US-S7-002, US-S7-003, US-S7-004, US-S7-005, US-S7-006  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Contacts filter rail | Account, status, owner (Current user), email, designation → server list filters | |
| 2 | Accounts filter rail | Status, type, industry, region → server list filters | |
| 3 | Deals filter rail | Stage, account, owner, min value, close from/to → server list filters | |
| 4 | Activities filter rail | Type, status, related type, assignee, due from/to → server list filters | |
| 5 | Documents filter rail | Entity type, visibility, uploaded by, created from/to → server list filters | |
| 6 | Whitelist | `*FilterFields.ALLOWED` matches UI catalog fields; unknown JPQL params ignored | |

## Components

- `backend/.../{Contact,Account,Deal,Activity,Document}FilterFields.java`
- `frontend/src/features/crm/*FilterCatalog.ts`
- List APIs + ModuleListShell filter panels on each page
