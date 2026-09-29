# MVP Completion Report

**Date:** 2026-09-28 (codebase follow-up)
**Scope:** Phases 1–9 implemented; Phase 10 audit + hardening (no V2 modules).

## 1. MVP completion percentage

**Estimated functional MVP: ~82%**
**Estimated production readiness: ~68%**

The readiness estimates below are the original Phase 10 assessment and have not been recalculated. Follow-up code review found several items below have since been implemented; remaining work is listed separately.

## 2. P0 issues

| Issue | Status |
| --- | --- |
| Deep-link bypass of nav permissions | **Fixed** — `RoutePermission` |
| Prod deploy with default JWT secret | **Fixed** — `ProdSecurityGuard` |
| Default DB password / JWT in yml for local | Mitigated — require env override in prod |

## 3. P1 issues

| Issue | Status |
| --- | --- |
| TEAM data scope collapses to OWN | Implemented in current code — team visibility includes same-team members and direct reports; team admin UI added |
| Regional AUDIT_VIEW is org-wide | Implemented in current code — audit queries are restricted to the user's visible regions |
| Documents table without API | Closed in current code — upload/list/download/delete APIs and Documents UI exist |
| Soft-delete unique regions/projects | **Fixed** — Flyway V15 |
| Swagger enabled by default | Production profile disables Swagger; local default remains enabled for development |
| In-memory login rate limit | Open |
| Thin frontend test coverage | Open |
| Cross-tenant automated tests | **Added** — `CrossTenantSecurityTest` |
| Golden path automated test | **Added** — `GoldenPathIntegrationTest` |
| Notifications inbox | **Fixed** — API + UI menu |

## 4. P2 issues

- Branches UI missing
- Lead import UI is implemented
- Allocation soft-delete API is now implemented using the existing delete marker and `RESOURCE_ALLOCATE` permission
- Shared configurable list tables and filters are implemented in core lists
- Search deep-links need further verification
- Dashboard SQL aggregations
- Assign notifications for lead/deal/task

## 5. Security findings

See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md). Code follow-up closes the previously listed regional audit and document API gaps. Login throttling and broader UI verification remain open.

## 6. Data integrity findings

See [DATABASE_AUDIT.md](./DATABASE_AUDIT.md). Lead convert / won-deal project / timesheet edit rules enforced in services. Soft-delete child orphan risk remains for projects.

## 7. Performance findings

See [PERFORMANCE_AUDIT.md](./PERFORMANCE_AUDIT.md). Fine at seed scale; dashboard in-memory aggregation is the main growth risk.

## 8. Test coverage findings

| Layer | Coverage |
| --- | --- |
| Backend flow/security | Auth, CRM, Project, Resource, Timesheet, Dashboard, GoldenPath, CrossTenant |
| Frontend | 3 smoke tests |
| Browser E2E | None |

## 9. Architecture findings

- Modular monolith packages match ARCHITECTURE intent
- ARCHITECTURE §18 footer was stale (updated in Phase 10)
- Shared UI kit (DataTable, RegionGuard) not built; DoD partially unmet
- Domain events table unused (V2 ready)

## 10. What was fixed in Phase 10

1. Route-level permission guards
2. Lead/deal mutations invalidate dashboards (+ related CRM keys on convert)
3. Flyway V15 soft-delete unique indexes for regions & projects
4. `ProdSecurityGuard` for prod JWT secret
5. Notifications list + mark-read API and topbar menu
6. `GoldenPathIntegrationTest` + `CrossTenantSecurityTest`
7. Full audit document set under `/docs`

## 11. What remains

1. Shared-store login rate limiting for multi-instance deployments
2. Assignment notifications
3. Branch administration UI
4. Dashboard aggregation scaling
5. Broader automated UI and browser-flow verification
6. Confirm shared non-local deployments use the production profile or disable Swagger explicitly

## 12. Ready for V2?

**Not yet for production customers.**

**Conditionally ready to start V2 development in parallel** if the team accepts:

- Internal/demo use only, or
- Explicit backlog for remaining P1 items above before external go-live

Do **not** claim production-ready solely because screens exist.

## 13. Recommended next phase

**Phase 10b — P1 closure (security & scope)** before heavy V2:

1. Team membership graph **or** temporarily widen Sales Manager / PM data_scope
2. `audit_logs.region_id` + filter
3. Document upload MVP **or** remove DOCUMENT claims from MVP marketing
4. Redis login rate limit
5. Playwright/Cypress golden-path smoke
6. `SWAGGER_ENABLED=false` in staging/prod compose

Then proceed to [V2_ROADMAP.md](./V2_ROADMAP.md) (invoicing / approval engine) with eyes open.
