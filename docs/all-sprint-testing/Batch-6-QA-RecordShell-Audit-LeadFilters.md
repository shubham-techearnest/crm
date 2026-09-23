# Batch 6 QA — Admin, RecordShell, Audit, Lead filters (S6-004 … S7-001)

**Stories:** US-S6-004, US-S6-005, US-S6-006, US-S6-007, US-S7-001  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Departments | ModuleListShell + FormKit create; filter by name/status | |
| 2 | Organization settings | ModuleListShell + FormKit sections; Save with UnsavedGuard | |
| 3 | Lead detail | RecordShell tabs Overview/Related/Activities/Notes/Documents/Audit (permission-aware) | |
| 4 | Account / Deal detail | Same RecordShell tab pattern | |
| 5 | Audit logs | Filter by action, entity, user, region, date; no payload/secrets shown | |
| 6 | Leads filters | Owner (incl. Current user), min value, created from/to, unconverted → uses `/leads/query` FilterEngine | |
| 7 | Saved view | Persists extended Lead filter conditions | |

## Components

- `frontend/src/components/RecordShell/`
- `frontend/src/features/crm/leadFilterCatalog.ts`
