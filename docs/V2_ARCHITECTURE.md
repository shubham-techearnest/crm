# V2 Architecture

**Status:** V2 implementation started — CRM Foundation (Step 0/0b). Finance modules not started.
**MVP baseline:** Modular monolith (Spring Boot + React), shared-schema multi-tenancy, JWT + permission codes + data scopes.  
**Parity analysis:** [V2_PRODUCT_ARCHITECTURE_REVIEW.md](./V2_PRODUCT_ARCHITECTURE_REVIEW.md), [ZOHO_PARITY_MATRIX.md](./ZOHO_PARITY_MATRIX.md)  
**Related:** [V2_DATABASE_DESIGN.md](./V2_DATABASE_DESIGN.md), [V2_API_DESIGN.md](./V2_API_DESIGN.md), [V2_SECURITY_MODEL.md](./V2_SECURITY_MODEL.md), [V2_MIGRATION_PLAN.md](./V2_MIGRATION_PLAN.md), [V2_ROADMAP.md](./V2_ROADMAP.md)

---

## 0. CRM platform foundation (prerequisite layer)

Zoho parity analysis showed the MVP **domain** is strong but the **CRM platform** (filters, saved views, notes, attachments, record shell) is thin. Before or overlapping early V2, add shared packages:

| Component | Purpose |
| --- | --- |
| `filter` / FilterEngine | Field-operator-value trees; always AND tenant scope |
| `view` / SavedView | Private/shared list configurations |
| `note` | Polymorphic notes related list |
| `document` | Implement API on existing `documents` table |
| `metadata` (optional spike) | Hybrid custom fields |
| `recordui` (frontend) | RecordShell + related tabs + timeline |

These are **not** Zoho copies — they are the minimum reusable platform to achieve functional CRM depth.

---

## 1. Goals

Version 2 extends the MVP CRM → Project → Resource → Timesheet platform into a commercial and operational suite:

1. **Finance** — bill customers from approved work  
2. **Procurement** — buy goods/services with controlled PO spend  
3. **Expenses** — capture and approve project/employee spend  
4. **Contracts** — commercial agreements and renewals  
5. **Advanced resources** — deeper capacity and cost visibility  
6. **Workflow engine** — automate cross-module reactions  
7. **Approval engine** — replace one-off approve endpoints over time  
8. **Advanced reporting** — including project profitability  
9. **Customer portal** — external least-privilege access  

Architecture rule: **remain a modular monolith**. Do not split microservices for V2.

---

## 2. Package / module map (backend)

```text
com.techearnest.crm/
├── common/                 ← extend: money helpers, outbox, schedulers
├── auth/                   ← add portal JWT audience
├── finance/                ← NEW: invoice, tax, payment, credit note
├── procurement/            ← NEW: vendor, PO
├── expense/                ← NEW
├── contract/               ← NEW
├── workflow/               ← NEW: definitions + runner
├── approval/               ← NEW: engine
├── portal/                 ← NEW: portal facade APIs
├── report/                 ← NEW: analytics aggregations
├── timesheet/              ← MODIFY: billable export, approval_request link
├── project/                ← MODIFY: contract_id, profitability read models
├── resource/               ← MODIFY: calendar / forecasts (advanced)
├── account/                ← MODIFY: contract lists, tax profile
├── notification/           ← MODIFY: reminder types
└── document/               ← COMPLETE MVP stub → used by expense/portal
```

Frontend mirrors modules under `src/features/{finance,procurement,expenses,contracts,portal,reports}/`.

---

## 3. Finance architecture

### 3.1 Domain services

| Service | Responsibility |
| --- | --- |
| `TaxRateService` | Catalog CRUD |
| `InvoiceService` | Draft lines, issue, void, status aggregates |
| `InvoiceBillingService` | Select unbilled approved time entries → draft lines |
| `PaymentService` | Capture partial/full payments; recalc invoice |
| `CreditNoteService` | Issue/apply credits |

### 3.2 Invariants (must be enforced in code + DB)

- Issued invoice monetary fields immutable  
- `time_entry` invoiced at most once  
- Payments cannot exceed remaining balance  
- All operations tenant + region scoped like CRM  

### 3.3 Integration with MVP

| MVP concept | V2 use |
| --- | --- |
| Approved timesheet | Eligibility gate |
| `time_entries.billable` + rates | Line amount |
| Account / Project / Deal | Invoice headers |
| Notifications | Invoice issued, payment received, overdue |
| Audit | ISSUE, PAY, VOID, CREDIT |

---

## 4. Procurement architecture

```text
VendorService → PurchaseOrderService → (ApprovalEngine) → send/receive
                                         ↓
                              optional ExpenseService.fromPoReceipt
```

**First slice:** thin approve (permission `PO_APPROVE` or reuse pattern) if Approval Engine not yet live.  
**Second slice:** migrate PO to Approval Engine without dropping status history.

Project link is for **cost attribution**, not inventory (inventory out of scope).

---

## 5. Expenses architecture

- Submitter is always a `Resource` (employee link)  
- Optional `project_id` for profitability  
- Receipts via Documents (`visibility=INTERNAL`)  
- Approval via engine; PM may approve project expenses when step resolves to project manager  

---

## 6. Contracts architecture

- Owned by Account; Projects optionally reference Contract  
- Reminder scheduler (Spring scheduled job + org timezone) emits notifications  
- Never expose margin fields to portal  

---

## 7. Profitability architecture

**Read model**, not a transactional ledger:

```text
Revenue   = invoiced net for project
Cost      = approved hours × cost_rate
Expenses  = approved project expenses
Profit    = Revenue − Cost − Expenses
```

Exposed only through `ReportService` with `REPORT_VIEW` and cost fields gated by `RATE_VIEW`.

Unbilled WIP: approved billable hours not yet on an invoice item.

---

## 8. Workflow engine

### 8.1 Model

```text
WorkflowDefinition
  └── Trigger (event_type)
        ├── Condition*  (AND within trigger)
        └── Action*     (ordered)
```

### 8.2 Runtime

1. Domain code publishes event → write **`domain_events` outbox** in same TX  
2. After commit, `OutboxProcessor` picks unprocessed rows  
3. Match workflows by org + event_type + entity_type  
4. Evaluate conditions against payload JSON  
5. Execute actions; record `workflow_runs`  

**Do not** use Kafka in V2. Redis optional for processor locking only.

### 8.3 Example

WHEN `DealStageChanged` AND `toStage=WON`  
THEN `CREATE_PROJECT` (if none), `NOTIFY` role PROJECT_MANAGER, `CREATE_DEFAULT_MILESTONE`.

MVP already creates projects via explicit API — workflow **automates** that path; keep manual API.

---

## 9. Approval engine

### 9.1 Model

```text
ApprovalWorkflow (per org + target_type)
  └── ApprovalStep* (SEQUENTIAL or PARALLEL)
        approver_type: USER | ROLE | MANAGER | DEPARTMENT | REGION
        approver_ref: uuid or role code
ApprovalRequest → ApprovalAction*
```

### 9.2 Resolution rules

| Type | Resolver |
| --- | --- |
| USER | Fixed user id |
| ROLE | Any user in org (region-filtered) with role |
| MANAGER | Target owner’s `users.manager_id` or resource.manager_id |
| DEPARTMENT | Users in same department |
| REGION | Users with REGION scope covering record.region_id + permission |

### 9.3 Module adapters

Each target implements `Approvable`:

- load entity, assert submitter, apply APPROVED/REJECTED side effects  
- Timesheet adapter updates existing status fields for backward compatibility  

---

## 10. Advanced resource management

Incremental on MVP allocations/utilization:

- Unavailability calendar  
- Enhanced utilization reports (by skill, region)  
- Forecasting heatmaps (frontend) from allocation projections  
- Stricter over-allocation policies (block without override already MVP)

---

## 11. Advanced reporting

| Report | Primary sources |
| --- | --- |
| Sales / pipeline | leads, deals (MVP dashboards extend) |
| Project health | projects, tasks, milestones |
| Utilization | allocations + capacity |
| Timesheet | timesheets/entries |
| AR / outstanding | invoices, payments |
| Expense | expenses |
| Profitability | invoices + costed hours + expenses |

APIs under `/api/v1/reports/*` — SQL aggregation first; materialized views only if measured slow.

---

## 12. Customer portal

### 12.1 Boundary

| | Internal app | Portal |
| --- | --- | --- |
| Users | `users` + roles | `portal_users` |
| Auth | JWT `aud=internal` | JWT `aud=portal` |
| API | `/api/v1/...` | `/api/v1/portal/...` |
| UI | existing shell | `/portal/*` layout |
| Scope | org/region/team/own | **single account_id** |

### 12.2 Allowed portal resources

- Own account profile (limited)  
- Projects for that account  
- Milestones / tasks (exclude internal-only flags if added)  
- Documents with `visibility=CUSTOMER`  
- Invoices & payments for that account  

### 12.3 Denied

- Cost rates, margins, profitability  
- Other accounts’ data  
- Resources, allocations, employee PII  
- Internal notes, audit logs, workflows  

---

## 13. Cross-cutting platform needs before/during V2

| Need | Why |
| --- | --- |
| Documents API (MVP residual) | Expense receipts + portal files |
| `domain_events` outbox | Workflow reliability |
| `audit_logs.region_id` | Regional finance isolation |
| Scheduler module | Overdue invoices, contract expiry |
| Money/tax utility library | Consistent rounding (HALF_UP, 2 dp) |

---

## 14. Non-goals for V2 architecture

- Full GL / double-entry accounting  
- Tax filing / GSTR returns  
- Inventory / warehouses  
- Native mobile apps  
- Microservices split  
- Multi-currency FX engine (single org currency)  

---

## 15. Impact on MVP modules (summary)

| MVP module | Change type |
| --- | --- |
| Timesheet | Unbilled query; optional approval_request_id; invoice lock on entries |
| Project | contract_id; profitability endpoint |
| Account | contracts/invoices child lists |
| Resource | cost used in reports; calendar extras |
| Notification | new types |
| Auth | portal audience |
| Documents | implement stub |
| Deal | workflow automation only |
| Dashboard | AR / profitability cards later |
