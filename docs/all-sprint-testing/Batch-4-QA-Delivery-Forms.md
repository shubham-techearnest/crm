# Batch 4 QA — Delivery module forms (S5-001 … S5-005)

**Stories:** US-S5-001, US-S5-002, US-S5-003, US-S5-004, US-S5-005  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Projects → Create | Primary: name/code/account/region/billing/status; Additional: PM/priority/dates/budget/hours/description | |
| 2 | Projects Save & New | Saves and clears form without closing | |
| 3 | Tasks → Create (project selected) | Primary: name/status/priority/due; Additional: start/hours/assignee/description | |
| 4 | Milestones → Create | Primary: name/due/status; Additional: sort order/description | |
| 5 | Resources → Create | Primary: region/type/designation/code/status; Additional: capacity/joining/(rates if RATE_VIEW) | |
| 6 | Allocations → Create | Primary: project/resource/dates; Additional: hours/%/role/status | |
| 7 | Dirty form + navigate away | Unsaved confirm appears | |
| 8 | Permissions | Create buttons only when PROJECT_CREATE / TASK_CREATE / MILESTONE_MANAGE / RESOURCE_MANAGE / RESOURCE_ALLOCATE | |

## Shared components

`frontend/src/components/FormKit/` — `FormSection`, `FormMoreDetails`, `FormActions`, `UnsavedGuard`
