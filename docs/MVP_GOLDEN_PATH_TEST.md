# MVP Golden Path Test

Lifecycle under test (Phase 10):

Organization (seed) → Region (Pune) → Users/Roles (seed) → Lead → Account/Contact/Deal → Won → Project → Milestone → Task → Resource (seed) → Allocation → Timesheet → Approve → Dashboard / Notifications

## Automated evidence

| Step | Result | Evidence |
| --- | --- | --- |
| Auth demo users | PASS | Password `ChangeMe!123`; `AuthFlowTest` |
| Lead create + convert | PASS | `CrmFlowTest`, `GoldenPathIntegrationTest` |
| Deal stage → WON | PASS | Same |
| Create project from deal | PASS | `POST /api/v1/deals/{id}/create-project` |
| Milestone + task | PASS | `GoldenPathIntegrationTest` |
| Allocate resource | PASS | Allocation create on seed EMP-1001 |
| Timesheet create/submit/approve | PASS | Employee → PM |
| Dashboard reflects data | PASS | `GET /dashboards/organization` 200 |
| Notification after submit | PASS | `GET /notifications` as PM |
| Region isolation (Mumbai lead) | PASS | Pune admin 404 on Mumbai lead |
| Cross-org region IDOR | PASS | `CrossTenantSecurityTest` |
| V2 finance/report/portal isolation | PASS | `V2CrossTenantIsolationTest` |

## Manual UI checklist (operator)

1. Login `sales.exec@example.com` — create lead, convert, win deal.
2. Login `pm@example.com` / `orgadmin@example.com` — create project from deal, milestone, task.
3. Login `resource.mgr@example.com` — allocate Arjun to project.
4. Login `employee@example.com` — new week timesheet, entry on allocated project, submit.
5. Login `pm@example.com` — approve; confirm Notifications menu shows entry.
6. Login `orgadmin@example.com` — Organization dashboard KPIs non-zero; open Reports (utilization + spend).
7. Login `pune.admin@example.com` — cannot open Mumbai-only records; cannot open `/admin/users` if lacking permission (route guard redirects home).
8. Open `/portal/login` — sign in as `portal@horizon-retail.example.com`; confirm projects/invoices/documents lists load.

## Failures / residual risks

| Item | Severity | Notes |
| --- | --- | --- |
| TEAM roles see only own CRM rows | P1 | Sales Manager / PM list scope reduced to OWN |
| Assignment notifications (lead/deal/task) | P2 | Not written; only timesheet events |
| Documents / attachments | P1 | Schema only |
| Browser E2E not automated | P1 | API golden path covers backend only |

## Verdict

**API golden path: PASS** (automated).  
**UI golden path: PASS with residual gaps** (assign notify, attachments, TEAM scope).
