# Version 2 Roadmap

V2 starts only after MVP golden path (Phases 1–10) is accepted and business UAT is complete.

**Architecture review (Phase 12 planning):** See detailed design + Zoho parity docs — do not implement modules from this file alone.

| Doc | Purpose |
| --- | --- |
| [PRODUCT_OPTIMIZATION_AND_V2_DELIVERY_PLAN.md](./PRODUCT_OPTIMIZATION_AND_V2_DELIVERY_PLAN.md) | **Execution plan** — Platform vs Tenant, UX, V2 sequence |
| [TECH_EARNEST_CRM_SPRINT_BACKLOG.xlsx](./TECH_EARNEST_CRM_SPRINT_BACKLOG.xlsx) | **Sprint + user story workbook** (update Status as you go) |
| [V2_PRODUCT_ARCHITECTURE_REVIEW.md](./V2_PRODUCT_ARCHITECTURE_REVIEW.md) | Executive blueprint + gate |
| [ZOHO_PARITY_MATRIX.md](./ZOHO_PARITY_MATRIX.md) | Zoho capability parity + sources |
| [CRM_PRODUCT_GAP_ANALYSIS.md](./CRM_PRODUCT_GAP_ANALYSIS.md) | Product gaps |
| [PRODUCT_SCOPE_DECISION_MATRIX.md](./PRODUCT_SCOPE_DECISION_MATRIX.md) | KEEP/ADD/EXCLUDE decisions |
| [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md) | Runtime modules, engines, portal boundary |
| [V2_DATABASE_DESIGN.md](./V2_DATABASE_DESIGN.md) | Tables, finance/tax/GST, profitability |
| [V2_API_DESIGN.md](./V2_API_DESIGN.md) | REST surface |
| [V2_SECURITY_MODEL.md](./V2_SECURITY_MODEL.md) | RBAC, portal vs internal |
| [V2_MIGRATION_PLAN.md](./V2_MIGRATION_PLAN.md) | Sequence, risks, MVP touchpoints |

Do not implement these modules until an implementation phase is explicitly approved. Schema sketches also appear in [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) §7.

---

## Status

| Phase | Name | Status |
| --- | --- | --- |
| 0 / 0b | CRM Foundation (Documents, FilterEngine, Saved Views, Notes) | **In progress** (Step 0–0b started 2026-09-21) |
| 11 | Finance (invoices, taxes, payments, credit notes) | Blocked until P0 foundation complete |
| 12 | Procurement (vendors, purchase orders) | Not started |
| 13 | Expenses and contracts | Not started |
| 14 | Workflow and approval engines | Not started |
| 15 | Analytics and customer portal | Not started |

**Implementation note:** Numeric phases 11–15 remain labeled for historical continuity. Delivery order follows [PRODUCT_OPTIMIZATION_AND_V2_DELIVERY_PLAN.md](./PRODUCT_OPTIMIZATION_AND_V2_DELIVERY_PLAN.md) and the Excel backlog: Platform → UX kit → **Metadata & ACL Studio** → Depth → Engines → Finance → … → Portal (S1–S26).

---

## Phase 11 — Finance

**Lifecycle:** Approved billable time (and/or milestone/fixed price) → invoice draft → issue → payment → outstanding balance.

### Deliver

- `invoices`, `invoice_items`, `taxes` / tax lines, `payments`, `credit_notes`
- GST-ready fields: tax rate, tax type (CGST/SGST/IGST/VAT), HSN/SAC optional, place of supply optional
- Invoice statuses: `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `VOID`, `OVERDUE`
- No negative totals; immutable issued invoices (corrections via credit note)
- Link invoice to account, project, optional deal
- Permission codes `INVOICE_*`, `PAYMENT_MANAGE`
- Finance UI: Invoices, payments
- Tests: cannot invoice another org; cannot see cost rates on portal; cannot issue empty invoice

### Acceptance slice

Deal → Project → Resource → Timesheet (approved, billable) → Invoice → Payment.

---

## Phase 12 — Procurement

### Deliver

- Vendors (may overlap account type `VENDOR` — **Assumption:** `vendors` is the procurement record; an Account of type VENDOR can be linked but is not required)
- Purchase orders, PO items
- Statuses: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SENT`, `PARTIAL_RECEIVED`, `CLOSED`, `CANCELLED`
- PO approval using the Phase 14 engine if that phase is sequenced first; otherwise a thin approve API that is replaced in Phase 14

**Preferred sequence:** If approval engine is needed for PO, implement **Phase 14 skeleton** (approval tables + service) before PO approve UI, or ship PO with the same explicit approve method pattern as timesheets, then migrate.

---

## Phase 13 — Expenses and contracts

### Expenses

- Employee, project, travel expenses
- `expenses`, `expense_items`
- Receipts via `documents`
- Submit/approve (approval engine)
- Project expense totals visible to PM/finance; cost rates still `RATE_VIEW`

### Contracts

- Customer contracts on account
- Value, start/end, renewal, payment terms
- Documents, expiry reminder notifications
- Never expose internal margin fields to portal users later

**Acceptance:** Project → Expense; Account → Contract → renewal reminder.

---

## Phase 14 — Workflow and approval engines

### Workflow

Generic:

`WorkflowDefinition` → `Trigger` → `Condition[]` → `Action[]`

Example:

- WHEN `deal.stage` becomes `WON`
- THEN `CREATE_PROJECT`, `NOTIFY` project manager, `CREATE_DEFAULT_TASKS`

MVP domain events are the trigger source. No Kafka.

Actions run after commit, asynchronously via Spring `@Async` or an outbox table (preferred for reliability).

### Approval

Reusable:

- `approval_workflows`, `approval_steps`, `approval_requests`, `approval_actions`
- Sequential and parallel steps
- Approver: user, role, manager, department, region
- Target types: timesheet, purchase_order, expense, invoice, deal, resource_allocation
- Migrate timesheet approval to the engine without losing history

Do not keep separate hard-coded approval graphs per module after this phase.

---

## Phase 15 — Analytics and customer portal

### Analytics

Report APIs (still paginated/aggregated in SQL):

- Sales and pipeline
- Project (progress, delayed, hours)
- Resource utilization
- Timesheet
- Invoice / outstanding
- Expense
- Profitability (revenue − cost; cost from timesheet hours × cost rate + expenses)

`REPORT_VIEW` plus finer codes if needed.

### Customer portal

Separate auth audience (`PORTAL_ACCESS`).

Allowed: own account's projects, milestones, tasks (non-internal), documents marked customer-visible, invoices, payments.

Denied: other customers; `cost_rate`; margins; internal notes; employee PII; allocations internals.

Different React route tree or app (`frontend` portal mode). **Assumption:** same frontend build, `/portal` routes, different layout, different API prefix `/api/v1/portal`.

---

## Cross-cutting V2 work

- Sidebar Finance / Contracts modules enabled by permission
- GST configuration per organization
- Reminder scheduler (contract expiry, overdue invoice, overdue task already in MVP)
- Field-level security tests expanded
- Performance: materialized dashboard views only if measured necessary

---

## What MVP must not break

V2 depends on:

- Stable UUIDs and FKs from lead → deal → project → time_entries
- Domain events
- `billable` + `billing_rate` on time entries
- `cost_rate` / `billing_rate` on resources and allocations
- Document entity polymorphism
- Permission catalog expansion without role hard-coding
