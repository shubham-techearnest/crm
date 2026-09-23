# Batch 15 QA — Project health, over-allocation, rate ACL, Account related, Approvals schema

**Stories:** US-S13-001, US-S13-002, US-S13-003, US-S13-004, US-S14-001  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Projects list | Health badge `ON TRACK` / `DELAYED` from end date + overdue milestones | |
| 2 | Projects → Filters → Delayed only | Only DELAYED health rows shown | |
| 3 | Allocations → Create overlapping over-capacity allocation | Warning before save; Confirm override only if `ALLOCATION_OVERRIDE` | |
| 4 | User without override | Cannot save over-allocated; server returns OVER_ALLOCATED | |
| 5 | User without `RATE_VIEW` → Resources / Allocations / Timesheets | Rate columns hidden; API redacts `billingRate`/`costRate` | |
| 6 | User with `RATE_VIEW` → Timesheets entry detail | Rate column visible when API returns rate | |
| 7 | Account → Related | Contacts, Deals, Activities, Projects (+ health), Documents, Notes; empty states; permission-scoped | |
| 8 | Flyway V24 | `approval_workflows`, `approval_steps`, `approval_requests`, `approval_actions` exist; Account related lists seeded | |

## Components

- `ProjectService.computeHealth` + Projects Health column / Delayed filter
- `AllocationService` dryRun + `AllocationsPage` confirm override UX
- `TimesheetService` / `FieldAclEvaluator` rate redaction + Timesheets Rate column gated by `RATE_VIEW`
- `V24__account_related_lists_and_approval_engine.sql` + `approval.domain.*` entities/repos
- `AccountsPage` Related handlers for project / document / note
