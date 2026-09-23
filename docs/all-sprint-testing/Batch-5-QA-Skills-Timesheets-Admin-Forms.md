# Batch 5 QA — Skills, Timesheets & Admin forms (S5-006 … S6-003)

**Stories:** US-S5-006, US-S5-007, US-S6-001, US-S6-002, US-S6-003  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Skills → Create | Primary: name; Additional: category; Save & New works | |
| 2 | Timesheets → Create | Primary: week start; UnsavedGuard on dirty cancel | |
| 3 | Timesheet detail → Add entry | Primary: project/date/hours; Additional: description/billable | |
| 4 | Users | ModuleListShell list/tiles + filter; create uses FormKit; detail drawer for roles/regions | |
| 5 | Roles | ModuleListShell + FormKit create; permission editor in drawer | |
| 6 | Regions | ModuleListShell + FormKit; parent under Additional details | |
| 7 | Permissions | Buttons gated by SKILL_MANAGE / TIMESHEET_* / USER_MANAGE / ROLE_MANAGE / REGION_MANAGE | |

## Shared components

`frontend/src/components/FormKit/` — `FormSection`, `FormMoreDetails`, `FormActions`, `UnsavedGuard`  
List shell: `ModuleListShell`
