# MVP Feature Gap Analysis

Evidence-based comparison of PRODUCT_SCOPE / ROLE_PERMISSION_MATRIX / API_DESIGN against the repository as of Phase 10 audit.

Status values: `COMPLETE` | `PARTIALLY_COMPLETE` | `MISSING` | `BROKEN` | `TECHNICAL_DEBT`

| Module | Feature | Status | Evidence | Gap | Priority |
| --- | --- | --- | --- | --- | --- |
| Auth | Login / refresh / logout / me | COMPLETE | `AuthService`, `AuthFlowTest` | — | — |
| Auth | JWT + httpOnly refresh cookie | COMPLETE | `JwtService`, `te_refresh` | Access token in localStorage (documented) | P3 |
| Auth | Login rate limit | PARTIALLY_COMPLETE | `LoginRateLimiter` in-memory | Not cluster-safe | P1 |
| Org | Organization CRUD (platform) | COMPLETE | `OrganizationController` | — | — |
| Region | Region CRUD + scoping | COMPLETE | `RegionService`, `AdminIsolationTest` | Soft-delete unique fixed in V15 | — |
| Branch | Branch CRUD | PARTIALLY_COMPLETE | Backend APIs exist | No frontend admin UI | P2 |
| Department | Department CRUD | COMPLETE | Backend + `DepartmentsPage` | — | — |
| Team | Team CRUD | PARTIALLY_COMPLETE | Backend APIs exist | No frontend admin UI | P2 |
| Users / Roles | Admin UI + APIs | COMPLETE | `UsersPage`, `RolesPage` | — | — |
| RBAC | Permission evaluator | COMPLETE | `AccessGuard` / `TenantAccess` | TEAM scope collapses to OWN | P1 |
| Audit | Mutation logging | COMPLETE | `AuditService` on CRUD/approve | No region_id; regional admins see org-wide | P1 |
| Audit | Audit log UI | COMPLETE | `AuditLogsPage` | — | — |
| Notifications | Timesheet submit/approve/reject | COMPLETE | `TimesheetService` + `NotificationService` | — | — |
| Notifications | Inbox API + UI | COMPLETE (Phase 10 fix) | `NotificationController`, `NotificationsMenu` | Assignment/overdue still deferred | P2 |
| Notifications | Lead/deal/task assign notify | MISSING | No writers | Deferred in MVP_ROADMAP | P2 |
| Documents | Upload / download | MISSING | Table V12 only; no Java API | Deferred attachments | P1 |
| Leads | CRUD, convert, export | COMPLETE | `LeadService`, UI | — | — |
| Leads | Assign | PARTIALLY_COMPLETE | API + CrmFlowTest | Thin assign UX | P2 |
| Leads | Import | MISSING | API method exists; no UI | PRODUCT_SCOPE import | P2 |
| Contacts / Accounts | CRUD | COMPLETE | Services + pages | — | — |
| Deals | Pipeline, stage, create project | COMPLETE | `DealService`, `DealsPage` | No drag-drop kanban | P3 |
| Activities | CRUD | COMPLETE | `ActivityService` | — | — |
| Projects | CRUD, from won deal | COMPLETE | `ProjectService`, `ProjectFlowTest` | — | — |
| Milestones / Tasks | CRUD, assign, comments | COMPLETE | Services + pages | Dependencies UI thin | P2 |
| Resources | CRUD, skills, rates | COMPLETE | `ResourceService` | — | — |
| Allocations | Create + over-allocation | COMPLETE | `AllocationService` | No soft-delete/end API | P2 |
| Timesheets | Weekly + approve/reject | COMPLETE | `TimesheetService`, tests | — | — |
| Dashboards | Five scoped dashboards | COMPLETE | `DashboardService`, UI | Generic chart titles | P3 |
| Search | Global ILIKE search | COMPLETE | `SearchService`, `GlobalSearch` | Hits open lists not detail | P2 |
| Frontend | Route permission guards | COMPLETE (Phase 10 fix) | `RoutePermission` | — | — |
| Frontend | Shared DataTable | MISSING | ag-grid unused | ARCHITECTURE DoD | P2 |
| Frontend | List search/filter/pagination UX | PARTIALLY_COMPLETE | APIs support; UI loads size 100 | No FilterPanel | P2 |
| Security | Cross-org isolation | PARTIALLY_COMPLETE | TenantAccess + new tests | Need broader matrix | P1 |
| Security | TEAM visibility | TECHNICAL_DEBT | `ownerFilterOrNull` | Team graph missing | P1 |
| Config | Prod JWT secret guard | COMPLETE (Phase 10 fix) | `ProdSecurityGuard` | Dev defaults remain for local | P0 mitigated |
| Config | Swagger default on | TECHNICAL_DEBT | `SWAGGER_ENABLED:true` | Disable outside local | P1 |
| Testing | Module flow tests | PARTIALLY_COMPLETE | Auth/CRM/Project/Resource/Timesheet/Dashboard | E2E browser missing | P1 |
| Testing | Golden path integration | COMPLETE (Phase 10) | `GoldenPathIntegrationTest` | — | — |

## Summary counts

| Status | Approx count |
| --- | --- |
| COMPLETE | Majority of MVP modules |
| PARTIALLY_COMPLETE | ~10 |
| MISSING | Documents, lead import UI, assign notifications, DataTable |
| BROKEN | None proven at audit time |
| TECHNICAL_DEBT | TEAM scope, Swagger default, in-memory rate limit |
