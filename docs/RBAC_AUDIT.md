# RBAC Audit

Seeded roles and permissions from `V14__seed_permissions_and_demo.sql`, validated against `ROLE_PERMISSION_MATRIX.md` and runtime `AccessGuard` / service checks.

Legend: Y = granted in seed + enforced in service; N = not granted; ~ = granted but scope weaker than matrix intent.

## Matrix (high level)

| Role | Module | View | Create | Update | Delete | Approve | Export |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SUPER_ADMIN | Platform/all | Y | Y | Y | Y | Y | Y |
| ORGANIZATION_ADMIN | Org modules | Y | Y | Y | Y | Y | Y |
| REGIONAL_ADMIN | Region CRM/PM | Y | Y | Y | Y | Y (timesheet) | Y |
| SALES_MANAGER | CRM | Y~ | Y~ | Y~ | Y~ | N | Y |
| SALES_EXECUTIVE | CRM OWN | Y | Y | Y | N | N | N |
| PROJECT_MANAGER | Projects/tasks/timesheet | Y~ | Y | Y | Y | Y | N |
| RESOURCE_MANAGER | Resources/alloc | Y | Y | Y | Y | N | Y |
| FINANCE_USER | Read-heavy + dashboards | Y | limited | N | N | N | Y |
| EMPLOYEE | Tasks/timesheets OWN | Y | Y (own TS) | Y | N | N | N |
| VIEWER | Read dashboards/CRM | Y | N | N | N | N | N |

`~` TEAM data_scope currently filters lists to the current user (`TenantAccess.ownerFilterOrNull`), so managers do not see full team pipelines as the matrix implies.

## Findings

| Finding | Priority | Detail |
| --- | --- | --- |
| TEAM ≠ team visibility | P1 | SALES_MANAGER / PROJECT_MANAGER scoped like OWN for lists/search/dashboards |
| Route deep-links | Fixed P0 | `RoutePermission` now wraps feature routes |
| DOCUMENT_* unused | P1 | Permissions seeded; no document APIs |
| REPORT_VIEW unused | P3 | V2 placeholder on disabled nav |
| TIMESHEET_SELF_APPROVE | OK | Not granted; self-approve returns 403 |
| ALLOCATION_OVERRIDE | OK | Resource manager has it; PM blocked on over-alloc |
| RATE_VIEW | OK | Employee masked; resource mgr sees rates |
| NOTIFICATION_VIEW | OK | Used by new inbox API |
| AUDIT_VIEW for regional admin | P1 | Org-wide audit list (no region column) |

## Recommendations

1. Implement team membership graph or temporarily set PM/Sales Manager to ORGANIZATION/REGION until team filtering exists.
2. Add `region_id` to `audit_logs` or restrict AUDIT_VIEW for REGION scope.
3. Either implement documents or remove DOCUMENT_* from MVP claims until built.
