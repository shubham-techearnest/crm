# API Design

Base path: `/api/v1`  
Style: REST + JSON  
Auth: `Authorization: Bearer <access_token>`  
Docs: OpenAPI 3 (springdoc) at `/v3/api-docs` (non-production Swagger UI)

APIs never return JPA entities. All payloads are DTOs.

---

## 1. Conventions

### 1.1 Success envelope (single resource)

```json
{
  "success": true,
  "data": {},
  "message": "Lead created successfully"
}
```

### 1.2 Success envelope (list)

```json
{
  "success": true,
  "data": [],
  "message": null,
  "pagination": {
    "page": 0,
    "size": 20,
    "totalElements": 100,
    "totalPages": 5
  }
}
```

### 1.3 Error envelope

```json
{
  "success": false,
  "data": null,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "code": "INVALID_FORMAT", "message": "Email is invalid" }
  ]
}
```

No stack traces in production.

### 1.4 HTTP status

| Status | When |
| --- | --- |
| 200 | GET/PUT/PATCH success |
| 201 | POST create |
| 204 | DELETE success (or 200 with envelope — **Assumption:** use 200 + envelope for consistency) |
| 400 | Malformed request |
| 401 | Missing/invalid token |
| 403 | Authenticated but not allowed |
| 404 | Not found or not visible in tenant/scope |
| 409 | Conflict (duplicate email, invalid state transition) |
| 422 | Business rule (end date before start, over-allocation without override) |
| 429 | Rate limited |
| 500 | Unexpected (generic message) |

### 1.5 List query parameters

Every major list endpoint:

| Param | Notes |
| --- | --- |
| `page` | 0-based |
| `size` | Default 20, max 100 |
| `sort` | `field,asc` or `field,desc` |
| `search` | Case-insensitive match on documented fields |

Common filters: `status`, `regionId`, `ownerId`, `departmentId`, `priority`, `stage`, `from`, `to`.

Pagination is executed in the database. Never load unbounded collections for the grid.

### 1.6 Identifiers

Path ids are UUIDs. Unknown or cross-tenant ids → 404/403 per [ARCHITECTURE.md](./ARCHITECTURE.md).

### 1.7 Idempotency

Creates are not idempotent unless `Idempotency-Key` is added later. MVP clients should not retry POST blindly.

### 1.8 Headers

| Header | Purpose |
| --- | --- |
| `Authorization` | Bearer JWT |
| `X-Request-Id` | Client or server generated; echoed in logs and response |

Do not accept `X-Organization-Id` as an authorization mechanism.

---

## 2. Authentication

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | Email/password → access + refresh |
| POST | `/auth/refresh` | public (refresh cookie/body) | Rotate tokens |
| POST | `/auth/logout` | public (refresh cookie) | Revoke refresh and clear cookie |
| GET | `/auth/me` | authenticated | Current user, permissions, regions, resourceId |

Login body: `{ "email", "password" }`  
Tokens: `{ "accessToken", "expiresIn", "tokenType": "Bearer" }` with refresh in httpOnly cookie **or** body. **Assumption:** refresh token in httpOnly cookie for web; documented in OpenAPI.

---

## 3. Administration

### Organizations

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/organizations` | `ORG_VIEW` (SUPER_ADMIN lists all) |
| POST | `/organizations` | `ORG_CREATE` |
| GET | `/organizations/{id}` | `ORG_VIEW` |
| PUT | `/organizations/{id}` | `ORG_UPDATE` |

Tenant users typically use GET of their own org only.

### Regions, branches, departments, teams

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/regions` | VIEW / MANAGE |
| GET/PUT | `/regions/{id}` | VIEW / MANAGE |
| GET/POST | `/branches` | VIEW / MANAGE |
| GET/PUT | `/branches/{id}` | VIEW / MANAGE |
| GET/POST | `/departments` | VIEW / MANAGE |
| GET/PUT | `/departments/{id}` | VIEW / MANAGE |
| GET/POST | `/teams` | VIEW / MANAGE |
| GET/PUT | `/teams/{id}` | VIEW / MANAGE |

Lists are org-scoped (and region-scoped for Regional Admin).

### Users and roles

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/users` | `USER_VIEW` / `USER_MANAGE` |
| GET/PUT | `/users/{id}` | VIEW / MANAGE |
| POST | `/users/{id}/roles` | `USER_MANAGE` |
| POST | `/users/{id}/regions` | `USER_MANAGE` |
| POST | `/users/{id}/deactivate` | `USER_MANAGE` |
| GET | `/roles` | `ROLE_VIEW` |
| POST/PUT | `/roles`, `/roles/{id}` | `ROLE_MANAGE` |
| GET | `/permissions` | `ROLE_VIEW` |

### Audit and notifications

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/audit-logs` | `AUDIT_VIEW` |
| GET | `/notifications` | authenticated (own) |
| POST | `/notifications/{id}/read` | own |
| POST | `/notifications/read-all` | own |

---

## 4. Documents

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/documents?entityType&entityId` | `DOCUMENT_VIEW` + parent access |
| POST | `/documents` (`multipart/form-data`) | `DOCUMENT_UPLOAD` |
| GET | `/documents/{id}/download` | `DOCUMENT_VIEW` |
| DELETE | `/documents/{id}` | `DOCUMENT_DELETE` |

Metadata only in JSON; bytes stream on download.

---

## 5. CRM

### Leads

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/leads` | `LEAD_VIEW` |
| POST | `/leads` | `LEAD_CREATE` |
| GET | `/leads/{id}` | `LEAD_VIEW` |
| PUT | `/leads/{id}` | `LEAD_UPDATE` |
| DELETE | `/leads/{id}` | `LEAD_DELETE` |
| POST | `/leads/{id}/assign` | `LEAD_ASSIGN` |
| POST | `/leads/{id}/convert` | `LEAD_CONVERT` |
| POST | `/leads/import` | `LEAD_IMPORT` |
| GET | `/leads/export` | `LEAD_EXPORT` |

Convert request (all optional except what business rules require):

```json
{
  "createAccount": true,
  "createContact": true,
  "createDeal": true,
  "accountId": null,
  "dealName": "Website redesign",
  "dealValue": 250000,
  "dealStage": "NEW"
}
```

Convert is **transactional**. Response includes created `accountId`, `contactId`, `dealId`. Lead status becomes `CONVERTED`.

Statuses: `NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL`, `NEGOTIATION`, `CONVERTED`, `LOST`.

### Contacts

`/contacts` — CRUD + export. Filters: account, region, owner, status.

### Accounts

`/accounts` — CRUD + export. Types: `PROSPECT`, `CUSTOMER`, `PARTNER`, `VENDOR`, `OTHER`.

Related reads (paginated):

- `GET /accounts/{id}/contacts`
- `GET /accounts/{id}/deals`
- `GET /accounts/{id}/projects`
- `GET /accounts/{id}/activities`

V2 adds invoices, contracts, payments on the same pattern.

### Deals

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/deals` | `DEAL_VIEW` |
| GET | `/deals/pipeline` | `DEAL_VIEW` (grouped by stage, still capped/paginated per column) |
| POST | `/deals` | `DEAL_CREATE` |
| GET | `/deals/{id}` | `DEAL_VIEW` |
| PUT | `/deals/{id}` | `DEAL_UPDATE` |
| DELETE | `/deals/{id}` | `DEAL_DELETE` |
| POST | `/deals/{id}/stage` | `DEAL_STAGE` |
| POST | `/deals/{id}/create-project` | `PROJECT_CREATE` + deal `WON` |

Stages: `NEW`, `QUALIFICATION`, `REQUIREMENT`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`.

Forecast on list/dashboard: `sum(value * probability / 100)` for open stages.

### Activities

`/activities` — CRUD + complete.

Query: `relatedEntityType`, `relatedEntityId`, `assignedTo`, `type`, `status`.

Types: `TASK`, `CALL`, `MEETING`, `NOTE`, `FOLLOW_UP`.

`GET /{entityType}/{id}/timeline` may alias to activities + audit subset for UI.

---

## 6. Projects

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/projects` | VIEW / CREATE |
| GET/PUT | `/projects/{id}` | VIEW / UPDATE |
| DELETE | `/projects/{id}` | `PROJECT_DELETE` |
| GET/POST | `/projects/{id}/milestones` | MILESTONE_* |
| PUT | `/milestones/{id}` | `MILESTONE_MANAGE` |
| GET/POST | `/projects/{id}/tasks` | TASK_* |
| GET/PUT | `/tasks/{id}` | TASK_* |
| POST | `/tasks/{id}/assign` | `TASK_ASSIGN` |
| POST | `/tasks/{id}/dependencies` | `TASK_UPDATE` |
| GET/POST | `/tasks/{id}/comments` | TASK_VIEW / UPDATE |

Task statuses: `TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`.  
Project statuses: `PLANNED`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`.  
Billing types: `FIXED_PRICE`, `HOURLY`, `MILESTONE`, `RETAINER`.

---

## 7. Resources and allocation

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/resources` | VIEW / MANAGE |
| GET/PUT | `/resources/{id}` | VIEW / MANAGE |
| GET/POST | `/skills` | VIEW / MANAGE |
| PUT | `/resources/{id}/skills` | `RESOURCE_MANAGE` |
| GET/POST | `/allocations` | VIEW / `RESOURCE_ALLOCATE` |
| GET/PUT | `/allocations/{id}` | VIEW / ALLOCATE |
| GET | `/resources/{id}/utilization` | `ALLOCATION_VIEW` |

Utilization response example:

```json
{
  "resourceId": "...",
  "periodStart": "2026-09-01",
  "periodEnd": "2026-09-30",
  "capacityHours": 160,
  "allocatedHours": 180,
  "availableHours": -20,
  "utilizationPercent": 112.5,
  "overAllocated": true,
  "warning": "OVER_ALLOCATED"
}
```

Over-allocation without `ALLOCATION_OVERRIDE` → **422** (or 200 with warning on dry-run). **Assumption:** POST allocation succeeds with warning if over-allocated **and** caller has override; otherwise 422. GET utilization always returns the warning flag.

Cost rates omitted unless `RATE_VIEW`.

---

## 8. Timesheets

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/timesheets` | `TIMESHEET_VIEW` |
| POST | `/timesheets` | `TIMESHEET_CREATE` |
| GET | `/timesheets/{id}` | VIEW in scope |
| PUT | `/timesheets/{id}` | CREATE (draft/rejected only) |
| POST | `/timesheets/{id}/entries` | CREATE |
| PUT | `/time-entries/{id}` | CREATE |
| DELETE | `/time-entries/{id}` | CREATE (draft) |
| POST | `/timesheets/{id}/submit` | `TIMESHEET_SUBMIT` |
| POST | `/timesheets/{id}/approve` | `TIMESHEET_APPROVE` |
| POST | `/timesheets/{id}/reject` | `TIMESHEET_APPROVE` |
| GET | `/timesheets/export` | `TIMESHEET_EXPORT` |

Reject body: `{ "reason": "..." }`.  
Self-approve → 403.  
Hours must be `> 0` and `<= 24` per entry; weekly cap configurable later (MVP: warn in service if > capacity, do not block unless specified in org settings).

Statuses: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`.

---

## 9. Dashboards

All GET, aggregations respect AccessGuard.

| Path | Permission |
| --- | --- |
| `/dashboards/organization` | `DASHBOARD_ORG` |
| `/dashboards/region?regionId=` | `DASHBOARD_REGION` |
| `/dashboards/sales` | `DASHBOARD_SALES` |
| `/dashboards/project` | `DASHBOARD_PROJECT` |
| `/dashboards/employee` | `DASHBOARD_EMPLOYEE` |

Cards return numeric KPIs + small series for charts (not raw thousands of rows).

---

## 10. Search

`GET /search?q=&types=LEAD,CONTACT,ACCOUNT,DEAL,PROJECT`  
Permission: union of view permissions; results filtered per type. Limit 20 per type.

---

## 11. V2 endpoints (reserved, not implemented in MVP)

```text
/invoices
/invoices/{id}/items
/invoices/{id}/issue
/payments
/credit-notes
/vendors
/purchase-orders
/purchase-orders/{id}/submit
/purchase-orders/{id}/approve
/expenses
/contracts
/workflows
/approval-workflows
/approval-requests
/reports/...
/portal/...
```

---

## 12. Validation (authoritative on server)

Examples:

- Email format; phone E.164 or org-local pattern
- Required fields per DTO
- `project.endDate >= startDate`
- Deal value ≥ 0; probability 0–100
- Timesheet hours valid
- Invoice totals ≥ 0 (V2)
- Allocation dates overlap handling documented in service (MVP: overlapping allocations allowed but hours summed for utilization)

Frontend Zod schemas mirror DTOs for UX only.

---

## 13. Security notes for API consumers

- Expired access token → 401; client refreshes once
- Frontend omitted buttons do not imply the API allows the call
- Export endpoints still apply the same row filters as GET lists
- Import validates every row; returns per-row errors

---

## 14. OpenAPI requirements

Each production operation documents:

- Summary, auth, required permission code
- Request/response schemas
- Validation error examples
- Pagination parameters

Internal-only actuator endpoints are not public product APIs.
