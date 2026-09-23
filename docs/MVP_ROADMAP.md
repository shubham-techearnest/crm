# MVP Roadmap

Work in **phases**. Do not generate the entire platform in one change set.

This file is the implementation plan for Phases 1–10. Version 2 is in [V2_ROADMAP.md](./V2_ROADMAP.md).

---

## Current status

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Repository analysis + architecture documents | **Complete** (this docs set) |
| 1 | Architecture scaffolding (apps, Docker, kernel) | **Complete** |
| 2 | Database (Flyway MVP schema + seed) | **Complete** |
| 3 | Authentication / authorization | **Complete** |
| 4 | Organization / region / user / roles | **Complete** |
| 5 | CRM | **Complete** |
| 6 | Projects | **Complete** |
| 7 | Resources | **Complete** |
| 8 | Timesheets | **Complete** |
| 9 | Dashboards | **Complete** |
| 10 | MVP testing + golden path | **In progress** (audit docs + hardening) |

Phase 1 scaffolding is in `backend/`, `frontend/`, and `docker-compose.yml`. Phase 9 dashboards and search are live; Phase 10 audits production readiness before V2.

---

## Phase 1 — Architecture scaffolding (proposed next)

**Goal:** A running modular monolith skeleton with no CRM feature screens yet.

**Backend**

- Maven Spring Boot 3 / Java 21 at `backend/`
- Packages under `com.techearnest.crm`
- `common` kernel: API envelope, exception handler, base entity, request ID filter
- `application.yml` via environment variables
- springdoc-openapi
- Spring Security stub (permit health; deny API until Phase 3) **or** a minimal JWT skeleton if it stays small
- Actuator health
- Flyway enabled against empty schema (baseline only)

**Frontend**

- Vite + React + TypeScript at `frontend/`
- Bootstrap + SCSS tokens
- React Router, TanStack Query, RHF + Zod
- App shell layout (sidebar/nav placeholders)
- Login route placeholder wired only after Phase 3
- Shared component stubs: `EmptyState`, `LoadingState`, `ErrorState` (no fake data grids)

**Infrastructure**

- `docker-compose.yml`: PostgreSQL 16, Redis, MinIO
- `.env.example`
- `.gitignore`
- Root `README.md` with how to run

**Tests**

- Backend context load test
- Frontend Vitest smoke test

**Out of Phase 1**

- Full IAM
- CRM entities
- Production AWS Terraform

Phase 1 is implemented. Do not start CRM screens until Phases 2–4 exist.

---

## Phase 2 — Database

- Flyway migrations for all **MVP** tables in [DATABASE_DESIGN.md](./DATABASE_DESIGN.md)
- Indexes, FKs, unique constraints, `deleted_at` where specified
- V2 tables **not** created yet (design only), unless a thin stub is needed — prefer not
- Dev seed: org, regions (West/South/North with cities), departments, roles, permissions, users (one per role), sample CRM/project/resource/timesheet rows
- No real personal data; obviously fake names/emails (`@example.com`)

**Exit:** Flyway V2–V14 applied on local PostgreSQL `techearnest_crm`. Demo org, roles, users, and golden-path sample rows are seeded.

---

## Phase 3 — Authentication and authorization

- Register/login only as invited/admin-created users (no public self-serve signup in MVP)
- BCrypt passwords
- JWT access + hashed refresh tokens
- `CurrentUser` + `AccessGuard`
- Permission evaluator
- CORS, login rate limit
- Security tests: unauthenticated 401, authenticated without permission 403

**Exit:** Login works; `/api/v1/auth/me` returns permissions and scope; refresh/logout work.

Phase 3 is implemented. JWT login is live against seeded users (`ChangeMe!123`). Do not start Phase 4 until this is approved.

---

## Phase 4 — Organization, region, user, roles

- CRUD (scoped) for organizations (Super Admin), regions, branches, departments, teams, users
- Role assignment; permission matrix seed
- Regional Admin assignment to region(s)
- Audit on mutations
- Admin UI: Users, Roles, Regions, Departments, Settings, Audit Logs
- Tests: org isolation, region isolation

**Exit:** Admin can complete golden-path steps 1–6.

Phase 4 is implemented. Org/region/department/user/role admin APIs and UI are live. Do not start Phase 5 until this is approved.

---

## Phase 5 — CRM

- Leads, contacts, accounts, deals, activities
- List + detail + forms using shared `DataTable`
- Lead convert transactional API
- Deal kanban + list; stage history
- Won deal “Create project” entry point (can 409 until Phase 6 exists — prefer implementing convert-to-project at start of Phase 6)
- Import/export leads
- Attachments + notes/activities
- Notifications: lead/deal assigned

**Exit:** Golden-path steps 7–13.

Phase 5 is implemented. Leads/contacts/accounts/deals/activities APIs and UI are live (convert, pipeline, CSV export). Attachments and assignment notifications stay thin/deferred. Do not start Phase 6 until this is approved.

---

## Phase 6 — Projects

- Projects, milestones, project tasks, subtasks, dependencies
- Create from won deal
- Task assignment, comments, attachments
- Progress roll-up
- Notifications: task assigned, overdue job (scheduled)

**Exit:** Golden-path steps 14–16.

Phase 6 is implemented. Projects/milestones/tasks APIs and UI are live, including create-from-won-deal. Attachments and overdue notification jobs are deferred. Do not start Phase 7 until this is approved.

---

## Phase 7 — Resources

- Resources, skills, resource skills
- Allocations + utilization + over-allocation warning
- Resource status derivation (available / partial / full)
- Hide cost rates without `RATE_VIEW`

**Exit:** Golden-path steps 17–18.

Phase 7 is implemented. Resources, skills, allocations, utilization, rate masking, and over-allocation override are live. Do not start Phase 8 until this is approved.

---

## Phase 8 — Timesheets

- Weekly timesheet + daily entries
- Submit / approve / reject
- Block self-approve
- Notifications

**Exit:** Golden-path steps 19–21.

Phase 8 is implemented. Weekly timesheets, daily entries, submit/approve/reject, self-approve blocked, notifications, and CSV export are live. Do not start Phase 9 until this is approved.

---

## Phase 9 — Dashboards

- Five dashboards with Recharts + cards
- Aggregations respect org/region/own scope
- Search across major entities (simple ILIKE + indexes; not Elasticsearch)

**Exit:** Golden-path step 22, scoped correctly.

Phase 9 is implemented. Five scoped dashboards (Recharts + KPI cards) and global search are live. Do not start Phase 10 until this is approved.

---

## Phase 10 — MVP testing and hardening

- Golden-path API integration test
- Security tests in [ARCHITECTURE.md](./ARCHITECTURE.md) §16 and master prompt §41
- OpenAPI completeness
- Seed demo script documented
- Performance sanity: paginated lists, no N+1 on detail graphs (fetch joins / DTO queries)
- UX pass: responsive shell, empty/error/loading states

**Exit:** MVP acceptance criteria in [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md) §6.

Phase 10 audit artifacts: [MVP_COMPLETION_REPORT.md](./MVP_COMPLETION_REPORT.md), [MVP_FEATURE_GAP_ANALYSIS.md](./MVP_FEATURE_GAP_ANALYSIS.md), [SECURITY_AUDIT.md](./SECURITY_AUDIT.md), and related audit docs. P0 route guards, prod JWT guard, notifications inbox, V15 soft-delete uniques, and golden-path/cross-tenant tests landed; remaining P1 items are listed in the completion report.

---

## Definition of done (every feature phase)

A module is not done until it is:

- Persisted in PostgreSQL
- Exposed via authorized REST APIs
- Organization- and region-aware
- Validated (UI + API)
- Tested
- Documented in OpenAPI
- Using shared UI (DataTable, forms, guards)
- Audited and notifying where specified

No placeholder business logic. No fake list data.

---

## Sequencing constraint

Do not start Phase 5 until Phases 1–4 are usable. CRM screens without tenant security would violate the product.

---

## Ask

**Please approve Phase 1** (bootstrap backend, frontend, Docker, common kernel, README).

After approval, implementation will stay inside Phase 1 and will not jump into CRM modules.
