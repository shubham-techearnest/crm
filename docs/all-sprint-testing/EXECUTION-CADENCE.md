# Execution cadence — Excel backlog

We implement the application **by user story order in the Excel sheet**, not whole sprints at once.

## Rules

1. Source of truth: `docs/TECH_EARNEST_CRM_SPRINT_BACKLOG_v2.xlsx` (UserStories sheet).
2. Work in **batches of 5** stories: next five rows with Status = `Not Started` (sheet order).
3. Before coding: set those 5 to `In Progress`.
4. After each story meets DoD: set Status = `Done`, fill `Updated On`.
5. After each batch of 5: add/update a short QA note under `docs/all-sprint-testing/` if the batch spans a sprint theme.
6. Do not skip ahead for convenience unless a Dependency blocks the batch (then mark `Blocked` and take the next available story).

## Status values

`Not Started` | `In Progress` | `Blocked` | `Done` | `Deferred`

## Helper

```bash
cd docs
node update-backlog-status.js --next 5
node update-backlog-status.js --progress US-S3-001,US-S3-002,US-S3-003,US-S3-004,US-S4-001
node update-backlog-status.js --done US-S3-001 --notes "Shipped"
```

## Completed so far

| Batch | Stories | Theme |
| --- | --- | --- |
| 1 | US-S1-001 … US-S1-004, US-S2-001 … US-S2-005, US-CX-003 | Platform Console + Organizations |
| 2 | US-S3-001 … US-S3-004, US-S4-001 | Prospect Orgs + Lead form |
| 3 | US-S4-002 … US-S4-006 | Contact/Account/Deal/Activity forms + FormKit |
| 10 | US-S8-004, US-S8-005, US-S9-001 … US-S9-003 | Field dictionary + Form/List designers + Lead DynamicForm |
| 11 | US-S9-004 … US-S9-006, US-S10-001, US-S10-002 | List prefs, form policies, related lists, Table ACL |
| 12 | US-S10-003 … US-S10-005, US-S11-001, US-S11-002 | Roles UX, ACL seed, nav ACL, Field ACL / rates |
| 13 | US-S11-003 … US-S11-005, US-S12-001, US-S12-002 | Module layouts, filterable, Studio audit, Lead bulk + dup warn |
| 14 | US-S11-006, US-S12-003 … US-S12-006 | Invoice Studio stub, Deal WON/LOST fields, Meeting/Call, Docs upload |
| 15 | US-S13-001 … US-S13-004, US-S14-001 | Project health, over-alloc UX, rate FLS, Account related, Approval schema |
| 16 | US-S14-002, US-S14-003, US-S15-001, US-S15-002, US-S16-001 | Timesheet dual-write, Approvals inbox, Outbox/Workflow Deal WON, Tax rates |
| 17 | US-S16-002, US-S16-003, US-S17-001 … US-S17-003 | Invoices draft/time-pull, Issue/Void/Overdue, payments, advanced filters |
| 19 | US-S20-001 … US-S21-002 | Expenses, Vendors, PO draft + Approval Engine |
| 20 | US-S22-001 … US-S23-003 | PO lifecycle, filters, Reports shell + sales/project analytics |
| 21 | US-S24-001 … US-S25-002 | AR aging, profitability, portal auth + read APIs |
| 22 | US-S26-001 … US-CX-002 | Portal UI, hardening checklist, UAT doc, UI states audit, saved view visibility |
| 23 | US-S5-008, US-S6-008, US-S12-007 … US-S15-003 | Timesheet polish, settings form, activity manage, skill matrix, workflow admin |
| 24 | US-S18-003, US-S23-004, US-S24-004, US-S3-005, US-CX-004, US-CX-005 | Finance nav, utilization/spend reports, prospect notes/docs, a11y, isolation tests |

## Working Excel file

If `TECH_EARNEST_CRM_SPRINT_BACKLOG_v2.xlsx` is locked in Excel, use:

`docs/TECH_EARNEST_CRM_SPRINT_BACKLOG_WORKING.xlsx`

Close Excel and replace the primary file with the working/status-update copy when convenient.
