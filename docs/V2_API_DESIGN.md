# V2 API Design

**Status:** Contract planning only — do not implement controllers yet.  
**Style:** Same as MVP — `/api/v1/...`, envelope `ApiResponse`, pagination, JWT bearer.  
**Related:** [API_DESIGN.md](./API_DESIGN.md), [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md), [V2_SECURITY_MODEL.md](./V2_SECURITY_MODEL.md)

---

## 1. Conventions (inherit MVP)

- Base path `/api/v1`
- Portal base path `/api/v1/portal`
- Soft delete via `POST /{id}/delete` or `DELETE` with soft semantics (pick one per module; prefer MVP consistency)
- Errors: `code`, `message`, `traceId`
- Money as number/string with 2 decimal places in JSON — **Assumption:** continue numeric JSON as MVP

---

## 2. Finance APIs

### 2.1 Tax rates

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/tax-rates` | `INVOICE_VIEW` or `ORG_UPDATE` |
| POST | `/tax-rates` | `ORG_UPDATE` / `INVOICE_CREATE` (decide: finance admin) |
| PUT | `/tax-rates/{id}` | same |

### 2.2 Invoices

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/invoices` | `INVOICE_VIEW` | filter account, project, status, date |
| GET | `/invoices/{id}` | `INVOICE_VIEW` | includes items + taxes + payments summary |
| POST | `/invoices` | `INVOICE_CREATE` | draft header |
| PUT | `/invoices/{id}` | `INVOICE_UPDATE` | draft only |
| POST | `/invoices/{id}/items` | `INVOICE_UPDATE` | |
| POST | `/invoices/{id}/items/from-time-entries` | `INVOICE_CREATE` | body: `timeEntryIds[]` |
| POST | `/invoices/{id}/issue` | `INVOICE_UPDATE` | assigns number |
| POST | `/invoices/{id}/void` | `INVOICE_DELETE` | |
| GET | `/invoices/export` | `INVOICE_VIEW` | CSV |

**Issue request:** optional overrides for issue_date.  
**Errors:** `EMPTY_INVOICE`, `ALREADY_ISSUED`, `TIME_ENTRY_ALREADY_INVOICED`, `UNAPPROVED_TIME`.

### 2.3 Payments

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/invoices/{id}/payments` | `INVOICE_VIEW` |
| POST | `/invoices/{id}/payments` | `PAYMENT_MANAGE` |
| GET | `/payments` | `PAYMENT_MANAGE` | org list |

**Errors:** `EXCEEDS_BALANCE`, `INVOICE_NOT_ISSUED`.

### 2.4 Credit notes

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/invoices/{id}/credit-notes` | `INVOICE_UPDATE` |
| POST | `/credit-notes/{id}/issue` | `INVOICE_UPDATE` |
| GET | `/credit-notes/{id}` | `INVOICE_VIEW` |

### 2.5 Unbilled WIP

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/billing/unbilled-time` | `INVOICE_CREATE` | query projectId, accountId, from, to |

Returns approved billable entries not linked to invoice items.

---

## 3. Procurement APIs

| Method | Path | Permission |
| --- | --- | --- |
| CRUD | `/vendors` | `VENDOR_VIEW` / `VENDOR_MANAGE` (add to catalog) |
| CRUD | `/purchase-orders` | `PO_VIEW` / `PO_CREATE` / `PO_UPDATE` |
| POST | `/purchase-orders/{id}/submit` | `PO_UPDATE` |
| POST | `/purchase-orders/{id}/approve` | `PO_APPROVE` or approval engine |
| POST | `/purchase-orders/{id}/reject` | same |
| POST | `/purchase-orders/{id}/items` | `PO_UPDATE` |

---

## 4. Expense APIs

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/expenses` | `EXPENSE_VIEW` / `EXPENSE_CREATE` |
| PUT | `/expenses/{id}` | owner or manage |
| POST | `/expenses/{id}/submit` | submitter |
| POST | `/expenses/{id}/approve` | `EXPENSE_APPROVE` |
| POST | `/expenses/{id}/reject` | `EXPENSE_APPROVE` |
| POST | `/expenses/{id}/items` | |
| POST | `/expenses/{id}/receipts` | document upload |

OWN scope: employees see own; PM sees project expenses; finance sees org.

---

## 5. Contract APIs

| Method | Path | Permission |
| --- | --- | --- |
| CRUD | `/contracts` | `CONTRACT_VIEW` / `CONTRACT_MANAGE` |
| GET | `/accounts/{id}/contracts` | `CONTRACT_VIEW` |
| POST | `/contracts/{id}/renew` | `CONTRACT_MANAGE` | creates successor or extends dates |

---

## 6. Workflow APIs

| Method | Path | Permission |
| --- | --- | --- |
| CRUD | `/workflows` | `WORKFLOW_MANAGE` |
| POST | `/workflows/{id}/enable` | `WORKFLOW_MANAGE` |
| GET | `/workflows/runs` | `WORKFLOW_MANAGE` | debug |
| GET | `/admin/outbox` | platform/org admin | optional ops |

Workflows are not triggered via public “run” API in normal ops — domain events drive them.

---

## 7. Approval APIs

| Method | Path | Permission |
| --- | --- | --- |
| CRUD | `/approval-workflows` | `APPROVAL_ADMIN` |
| GET | `/approval-requests` | inbox for current user |
| GET | `/approval-requests/{id}` | participant |
| POST | `/approval-requests/{id}/actions` | body: `APPROVE`/`REJECT`/`COMMENT` |

Module submit endpoints create `approval_requests` internally.

---

## 8. Reporting APIs

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/reports/sales` | `REPORT_VIEW` |
| GET | `/reports/pipeline` | `REPORT_VIEW` |
| GET | `/reports/projects` | `REPORT_VIEW` |
| GET | `/reports/utilization` | `REPORT_VIEW` |
| GET | `/reports/timesheets` | `REPORT_VIEW` |
| GET | `/reports/receivables` | `REPORT_VIEW` + `INVOICE_VIEW` |
| GET | `/reports/expenses` | `REPORT_VIEW` + `EXPENSE_VIEW` |
| GET | `/reports/profitability` | `REPORT_VIEW`; cost fields need `RATE_VIEW` |

All accept `organizationId` (platform), `regionId`, date range; respect data scope.

---

## 9. Portal APIs

Prefix: `/api/v1/portal`

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/login` | portal_users |
| POST | `/auth/refresh` | |
| GET | `/me` | account summary |
| GET | `/projects` | account-scoped |
| GET | `/projects/{id}` | |
| GET | `/projects/{id}/milestones` | |
| GET | `/projects/{id}/tasks` | filtered |
| GET | `/documents` | visibility=CUSTOMER |
| GET | `/invoices` | |
| GET | `/invoices/{id}` | |
| GET | `/payments` | |

**No** cost, resource, allocation, audit, or admin routes under portal.

---

## 10. MVP API modifications (additive)

| Existing API | Additive change |
| --- | --- |
| `GET /projects/{id}` | include `contractId`, optional profitability summary if permitted |
| `GET /time-entries` or billing endpoint | unbilled filter |
| `POST /timesheets/{id}/approve` | optionally create/complete approval_request |
| `GET /accounts/{id}` | links to contracts/invoices counts |
| Documents | new `/documents` CRUD (MVP gap) |

Prefer **additive** DTO fields with null defaults — no breaking removals.

---

## 11. Event types (for workflow)

Publish (outbox) at least:

- `LEAD_CONVERTED`
- `DEAL_STAGE_CHANGED`
- `PROJECT_CREATED`
- `TIMESHEET_SUBMITTED` / `TIMESHEET_APPROVED`
- `INVOICE_ISSUED` / `INVOICE_OVERDUE`
- `PAYMENT_CAPTURED`
- `PO_SUBMITTED`
- `EXPENSE_SUBMITTED`
- `CONTRACT_EXPIRING`

Payload always includes `organizationId`, `regionId`, aggregate ids.

---

## 12. OpenAPI

- Tag groups: Finance, Procurement, Expenses, Contracts, Workflow, Approvals, Reports, Portal  
- Separate OpenAPI group or second doc for Portal to reduce accidental internal exposure in customer-facing Swagger (Swagger disabled in prod anyway)
