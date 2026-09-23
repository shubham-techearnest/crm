# Architecture

**Product:** TechEarnest CRM + Project + Resource Management Platform  
**Style:** Modular monolith  
**Tenancy:** Shared database, shared schema, `organization_id` isolation  
**Status:** Greenfield (repository was empty at analysis time)

This document defines the technical architecture for MVP and the extension points required for Version 2. It does not authorize implementation of V2 modules during MVP.

---

## 1. Current repository findings

Analyzed: `C:\Users\ParmeshwarSuryawansh\CRM - Techearnest`

| Item | Finding |
| --- | --- |
| Frontend framework | None |
| Backend framework | None |
| Database | None |
| Authentication | None |
| Dependencies | None |
| Folder structure | Empty workspace (0 files) |
| Coding conventions | None yet — conventions below become the standard |
| Environment configuration | None |
| Database migrations | None |
| Reusable UI components | None |

**Assumption:** This is a new product. The stack in the master prompt is the source of truth. No existing code will be rewritten or discarded.

---

## 2. Proposed repository layout

Initialize as a single repository with two deployable applications:

```text
/
├── docs/
├── backend/                          Spring Boot 3.x, Java 21, Maven
│   ├── pom.xml
│   └── src/
│       ├── main/java/com/techearnest/crm/
│       ├── main/resources/
│       │   ├── application.yml
│       │   └── db/migration/         Flyway
│       └── test/java/com/techearnest/crm/
├── frontend/                         React 18, TypeScript, Vite
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
├── docker-compose.yml                PostgreSQL, Redis, MinIO
├── .env.example
└── README.md
```

**Assumption:** Monorepo (not polyrepo) so API contracts, seed data, and docs stay in one place. Kubernetes and microservices are out of scope.

---

## 3. Technology stack

### 3.1 Frontend

| Concern | Choice |
| --- | --- |
| UI library | React 18 + TypeScript |
| Bundler | Vite |
| Routing | React Router |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod |
| CSS | Bootstrap 5 + SCSS (no Tailwind) |
| Data grid | AG Grid Community |
| Charts | Recharts |
| HTTP | Axios instance with interceptors |

### 3.2 Backend

| Concern | Choice |
| --- | --- |
| Language | Java 21 |
| Framework | Spring Boot 3.x |
| Security | Spring Security + JWT (access + refresh) |
| Persistence | Spring Data JPA + Hibernate |
| Validation | Bean Validation (Jakarta) |
| Migrations | Flyway |
| API docs | springdoc-openapi |
| Build | Maven |

### 3.3 Infrastructure (MVP)

| Concern | Local | Production target |
| --- | --- | --- |
| App hosting | Docker Compose | AWS ECS/EC2 (not Kubernetes) |
| Database | PostgreSQL 16 | Amazon RDS PostgreSQL |
| Files | MinIO | S3-compatible object storage |
| Cache / rate limit | Redis | ElastiCache Redis |
| Email | Mailpit / log sink | AWS SES |
| Logs | stdout JSON | CloudWatch |

Secrets (JWT signing key, DB password, S3 credentials) come from environment variables only. Never commit secrets.

---

## 4. Architectural principles

1. **Modular monolith first.** One deployable backend, packages by domain.
2. **DTOs at the API boundary.** Never return JPA entities from controllers.
3. **Business logic in services.** Controllers validate HTTP concerns only.
4. **Organization isolation is mandatory.** Every query for tenant data filters `organization_id`.
5. **Region and ownership are backend concerns.** Frontend hiding is UX only.
6. **Permissions are data, not `if` statements in controllers.** Use a permission catalog + role mapping.
7. **Soft-delete important records.** Use `deleted_at`; do not physically delete CRM/project/finance history unless required.
8. **Connected lifecycle.** Lead → Account/Contact → Deal → Project → Resource → Timesheet (→ Invoice in V2).
9. **Extension points, not premature engines.** Design for workflow/approval; do not build the V2 engines in MVP.
10. **No fake APIs.** Screens talk to real PostgreSQL-backed endpoints.

---

## 5. Backend module structure

Package root: `com.techearnest.crm`

```text
com.techearnest.crm
├── common                 shared kernel
│   ├── api                ApiResponse, PageResponse, request IDs
│   ├── exception          problem types + @RestControllerAdvice
│   ├── persistence        BaseEntity, auditing, org/region filters
│   ├── security           JWT, current user, permission evaluator
│   ├── storage            S3/MinIO adapter
│   ├── validation
│   └── event              domain events (V2 workflow hook)
├── auth
├── organization
├── region
├── branch
├── department
├── team
├── user
├── role
├── permission
├── audit
├── notification
├── document
├── lead
├── contact
├── account
├── deal
├── activity
├── project
├── milestone
├── task                   project tasks (not CRM activities)
├── resource
├── skill
├── allocation
├── timesheet
├── dashboard
└── search                 shared list query helpers
```

V2 packages (`invoice`, `purchaseorder`, `expense`, `contract`, `workflow`, `approval`, `report`, `portal`) are reserved. Do not create feature implementations there during MVP. Empty package placeholders are optional; prefer adding packages when the phase starts.

Each feature module typically contains:

```text
<module>/
├── api/<Module>Controller.java
├── api/dto/
├── api/mapper/
├── application/<Module>Service.java
├── domain/<Entity>.java
├── domain/<Module>Repository.java
├── domain/<enums>
└── application/validation/
```

---

## 6. Frontend architecture

Feature-based structure:

```text
frontend/src/
├── app/                   providers, bootstrap
├── routes/                route objects + guards
├── layouts/               AppShell (sidebar, top nav, breadcrumb)
├── components/            reusable design system
│   ├── DataTable/
│   ├── SearchBar/
│   ├── FilterPanel/
│   ├── Pagination/
│   ├── StatusBadge/
│   ├── ConfirmDialog/
│   ├── Modal/
│   ├── FormField/
│   ├── DatePicker/
│   ├── Select/
│   ├── MultiSelect/
│   ├── FileUploader/
│   ├── ActivityTimeline/
│   ├── EmptyState/
│   ├── LoadingState/
│   ├── ErrorState/
│   ├── PermissionGuard/
│   └── RegionGuard/
├── hooks/
├── services/              domain API clients (no raw fetch in views)
├── api/                   axios client, interceptors, token refresh
├── utils/
├── types/
├── constants/
├── styles/                Bootstrap overrides + SCSS tokens
└── features/
    ├── auth/
    ├── organization/
    ├── users/
    ├── regions/
    ├── leads/
    ├── contacts/
    ├── accounts/
    ├── deals/
    ├── activities/
    ├── projects/
    ├── tasks/
    ├── resources/
    ├── allocations/
    ├── timesheets/
    ├── dashboards/
    └── admin/
```

**Rules:**

- No database or authorization logic in React components.
- TanStack Query owns server cache. Forms own local draft state.
- `localStorage` may hold the access token for UX; it is never the source of truth for permission.
- One `DataTable` wrapper around AG Grid for all enterprise lists.

---

## 7. Multi-tenancy

**Model:** discriminator column `organization_id` (UUID, FK to `organizations`).

- Super Admin users may have `organization_id = null` (platform operators).
- Every other user belongs to exactly one organization.
- Every organization-owned business table includes `organization_id NOT NULL`.
- Repositories always constrain by the current user's organization, except Super Admin platform operations.

Enforcement layers (all required):

1. JWT claims include `userId`, `organizationId`, role ids, region ids, permission codes.
2. `TenantContext` populated from the authenticated principal (not from a client-supplied header as the authority).
3. Service-layer access policy (`AccessGuard`).
4. Query specifications / Hibernate filters as defense in depth.
5. Tests that prove org A cannot read org B.

Clients must not send `organizationId` to select another tenant. If present on write DTOs, it is ignored unless the caller is Super Admin performing an explicit platform operation.

---

## 8. Organization hierarchy

```text
Organization
 └── Region
      └── Branch
           └── Department
                └── Team
                     └── User
```

Example:

```text
TechEarnest Demo Org
├── West
│   ├── Pune
│   └── Mumbai
├── South
│   ├── Bangalore
│   └── Hyderabad
└── North
    ├── Delhi
    └── Gurgaon
```

Record context:

- Always: `organization_id`
- When geographically meaningful: `region_id` (leads, accounts, deals, projects, resources, timesheets)
- Optional: `branch_id`, `department_id` for reporting and finer access

`Team` exists in the data model from day one so later “Sales Manager sees team records” does not require a schema break. MVP UI can keep team management minimal.

---

## 9. Identity, authentication, and session

### 9.1 Authentication

- Local username/email + password.
- Passwords hashed with BCrypt (strength ≥ 12). Argon2 may replace BCrypt later without API change.
- Access token: JWT, short-lived (e.g. 15 minutes).
- Refresh token: opaque, stored hashed in `refresh_tokens`, rotatable, revocable.
- Logout revokes the refresh token.
- Failed logins are rate-limited (Redis).

JWT payload (non-sensitive):

- `sub` = user id
- `org` = organization id (nullable for Super Admin)
- `perms` = permission codes (or a version hash if the token would be too large — then load permissions from Redis/DB per request)
- `scope` = data scope
- `regions` = assigned region ids

**Assumption:** If the permission list is large, store a `perm_version` in JWT and cache permissions in Redis keyed by user id. Authorization always re-checks on the server.

### 9.2 Current user

`CurrentUser` (security principal) exposes:

- userId, organizationId, email, displayName
- dataScope (`PLATFORM | ORGANIZATION | REGION | DEPARTMENT | TEAM | OWN`)
- regionIds, departmentIds, teamIds
- permission set
- resourceId (if the user is also a resource)

---

## 10. Authorization architecture

Authorization is three-dimensional:

1. **Permission** — can the user invoke this action at all? (`LEAD_CREATE`)
2. **Tenant** — is the record in an allowed organization?
3. **Record scope** — region / department / team / ownership / assignment

### 10.1 AccessGuard (reusable backend)

All mutations and sensitive reads go through a shared service, not ad-hoc controller checks.

```text
AccessGuard.requirePermission(LEAD_VIEW)
AccessGuard.requireOrganization(record.organizationId)
AccessGuard.requireRecordAccess(record)   // region + owner + team
```

Frontend `PermissionGuard` / `RegionGuard` only hide UI.

### 10.2 Data scope

| Scope | Typical roles | Visible records |
| --- | --- | --- |
| PLATFORM | SUPER_ADMIN | All organizations |
| ORGANIZATION | ORGANIZATION_ADMIN, FINANCE_USER (org-wide) | Entire org |
| REGION | REGIONAL_ADMIN | Assigned region(s) |
| DEPARTMENT | Optional managers | Assigned department(s) |
| TEAM | SALES_MANAGER, PROJECT_MANAGER (team) | Team members' records + own |
| OWN | SALES_EXECUTIVE, EMPLOYEE | Owned or assigned records |

Regional Admin never receives another region's rows from list or get-by-id APIs. A 404 is returned for out-of-scope ids (do not leak existence across regions/orgs where avoidable; 403 is acceptable when the user is authenticated but forbidden).

**Assumption:** Prefer `404` for missing-or-out-of-tenant records and `403` when the record is in-tenant but the user lacks permission/scope.

---

## 11. Domain event bus (V2 extension point)

MVP publishes in-process Spring application events after successful commits:

- `LeadConvertedEvent`
- `DealStageChangedEvent`
- `DealWonEvent`
- `ProjectCreatedEvent`
- `TimesheetSubmittedEvent`
- `TimesheetApprovedEvent`
- `TimesheetRejectedEvent`
- `TaskAssignedEvent`

MVP listeners:

- Audit log writer
- Notification writer

V2 will add workflow engine listeners on the same events. Do not call other modules' internals from controllers; publish events.

Do not introduce Kafka in MVP.

---

## 12. Approval extension point (V2)

MVP timesheet approve/reject is an explicit service method (`TimesheetService.approve`) that:

- Checks `TIMESHEET_APPROVE`
- Prevents self-approval unless a future permission `TIMESHEET_SELF_APPROVE` exists (default: denied)
- Writes audit + notification

Internally, persist enough fields (`approved_by`, `approved_at`, `status`) so a later `approval_requests` table can take over without rewriting timesheet history.

Do not copy-paste unrelated approval state machines into every module. When V2 starts, extract `ApprovalService` and migrate timesheets onto it.

---

## 13. File storage

- Metadata in `documents`
- Bytes in S3/MinIO (`storage_key`)
- Validate content type, size, and extension
- Access checks use the parent entity's org/region/permissions
- No files stored in PostgreSQL BYTEA

---

## 14. Cross-cutting backend

| Concern | Approach |
| --- | --- |
| API envelope | `{ success, data, message, pagination?, errors? }` |
| Errors | `@RestControllerAdvice`; no stack traces in production |
| Validation | Bean Validation + service-level business rules (422) |
| Auditing | Entity listeners + explicit audit service for business actions |
| Logging | JSON logs with `requestId`, `userId`, `organizationId`, module, operation |
| IDs | UUID v4 |
| Time | Store UTC; org timezone for display |
| Pagination | Database `LIMIT/OFFSET` via Spring Data `Pageable` |
| Import/export | CSV for MVP; async if file is large |
| OpenAPI | `/v3/api-docs` and Swagger UI in non-prod |

---

## 15. Security baseline

- CORS allow-list from configuration
- CSRF not required for stateless JWT APIs; protect cookie mode if cookies are used for refresh
- Parameterized JPA queries only
- Rate limit login and refresh
- Secure headers (Spring Security defaults)
- Upload malware/type checks (size + MIME + extension)
- Never log passwords, tokens, or secrets
- Never store JWT signing keys in source

---

## 16. Testing strategy

| Layer | Tool | Focus |
| --- | --- | --- |
| Unit | JUnit 5 + Mockito | services, access guard, converters |
| Persistence | `@DataJpaTest` + Testcontainers PostgreSQL | queries, isolation |
| API | `@SpringBootTest` + MockMvc | authn/z, validation, envelopes |
| Security | dedicated tests | org isolation, region isolation, timesheet self-approve |
| Frontend | Vitest + React Testing Library | form validation, permission guards |

Golden-path integration test (MVP): Lead convert → Deal won → Project → Allocation → Timesheet submit/approve.

---

## 17. Coding conventions (established now)

**Backend**

- Classes: `LeadService`, `LeadController`, `LeadMapper`
- DTOs: `LeadCreateRequest`, `LeadUpdateRequest`, `LeadResponse`
- Tables: `snake_case` plural
- Enums stored as strings
- No business logic in entities beyond invariants

**Frontend**

- Feature folders with `api.ts`, `types.ts`, `pages/`, `components/`
- Query keys: `['leads', filters]`
- SCSS modules or feature SCSS, plus global tokens
- Bootstrap utility classes allowed; no Tailwind

**Git**

- Conventional, imperative commit messages when commits are requested
- Never commit `.env`, keys, or dumps

---

## 18. Implementation status

See [MVP_ROADMAP.md](./MVP_ROADMAP.md) for phase status.

Phases 1–9 are implemented in `backend/` and `frontend/`. Phase 10 is the production audit and hardening pass (see `docs/MVP_COMPLETION_REPORT.md`). V2 modules are intentionally not started.
