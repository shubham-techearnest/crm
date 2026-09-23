# V2 Database Design

**Status:** Design only — do not implement until a V2 implementation phase is approved.  
**Base:** MVP Flyway `V1`–`V15` + [DATABASE_DESIGN.md](./DATABASE_DESIGN.md)  
**Related:** [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md), [V2_MIGRATION_PLAN.md](./V2_MIGRATION_PLAN.md)

This document expands the sketch in DATABASE_DESIGN §7 into implementable table definitions, constraints, and relationships for Version 2.

---

## 1. Design principles (unchanged from MVP)

| Principle | Rule |
| --- | --- |
| Tenancy | Every business row has `organization_id` (except platform-only tables) |
| Soft delete | Prefer `deleted_at`; unique indexes partial on `deleted_at IS NULL` |
| Money | `numeric(18,2)`; never float |
| IDs | UUID PKs; never expose sequential surrogate IDs cross-tenant |
| Immutability | Issued invoices and posted payments are append-only corrections via credit notes / adjustments |
| Auditing | Continue `audit_logs`; extend with `region_id` where missing (MVP residual) |

---

## 2. Finance data model

### 2.1 Business chain

```text
Account
  └── Contract (optional commercial umbrella)
        └── Project (optional; may also link Account directly)
              └── Timesheet → TimeEntry (billable=true, approved timesheet)
                    └── InvoiceItem (links time_entry_id OR free-form)
                          └── Invoice
                                ├── Payment (0..n; partial OK)
                                └── CreditNote (0..n; corrections)
```

Also allowed:

- Invoice → Account (required) without Project (account-level fee)
- Invoice → Deal (optional attribution)
- InvoiceItem without `time_entry_id` (milestone / fixed-price / manual line)

### 2.2 Invoice numbering

| Decision | Choice |
| --- | --- |
| Scope | Unique per **organization** (not global) |
| Format | Configurable prefix + year + sequence, e.g. `TE-{YYYY}-{000001}` |
| Storage | `invoices.invoice_number` varchar(64) NOT NULL |
| Sequence | Table `invoice_number_sequences` (`organization_id`, `fiscal_year`, `next_value`) allocated in a transaction on **ISSUE** (not on DRAFT) |
| Gaps | Allowed on VOID of issued invoices (number retained; do not reuse) |

**Assumption:** Fiscal year follows calendar year unless org settings later add `fiscal_year_start_month`.

### 2.3 Currency

| Layer | Source |
| --- | --- |
| Default | `organizations.currency_code` (MVP: `INR`) |
| Invoice | Snapshot `currency` char(3) at create — do not change after ISSUE |
| Multi-currency | **Out of V2 core** — single currency per org for V2.1; store FX fields as nullable extension points only |

### 2.4 Tax architecture (GST-ready)

```text
tax_rates (org catalog)
  └── invoice_item_taxes (line-level applied rates; supports split CGST+SGST)
```

| Table | Purpose |
| --- | --- |
| `tax_rates` | Org tax catalog: name, rate %, type, effective_from/to, is_active |
| `invoice_items.tax_inclusive` | boolean — whether unit_price includes tax |
| `invoice_item_taxes` | One or more tax lines per item (CGST+SGST or IGST) |
| `invoices.place_of_supply` | Optional varchar (state/UT code) |
| `accounts.tax_number` | Already MVP (GSTIN-ready) |
| `organizations` | Add optional `tax_number`, `place_of_supply_default` in V2 migration |

**Tax types:** `CGST`, `SGST`, `IGST`, `VAT`, `OTHER`.

**Rule:** For Indian intra-state: typically CGST+SGST pair; inter-state: IGST. Validation is org-configurable, not hard-coded to one country in the engine.

### 2.5 Payment terms

| Field | Location |
| --- | --- |
| `payment_terms_days` | `contracts`, `invoices` (invoice snapshots from contract or org default) |
| `due_date` | `invoices` = `issue_date` + terms (editable while DRAFT) |
| Org default | `organization_settings.default_payment_terms_days` (new small settings table or columns on organizations) |

### 2.6 Invoice status

| Status | Meaning |
| --- | --- |
| `DRAFT` | Editable; no number reserved yet (or provisional number marked provisional — **Assumption:** number on ISSUE only) |
| `ISSUED` | Immutable money fields; corrections via credit note |
| `PARTIALLY_PAID` | `sum(payments) > 0` and `< total - credits` |
| `PAID` | Settled |
| `OVERDUE` | Derived or nightly job: `ISSUED`/`PARTIALLY_PAID` and `due_date < today` |
| `VOID` | Cancelled issued invoice; no further payments |

Transitions: `DRAFT → ISSUED → (PARTIALLY_PAID) → PAID`; `DRAFT → VOID`; `ISSUED → VOID` only if unpaid and policy allows.

### 2.7 Payment status

Payments are rows, not a parallel enum on invoice alone:

| `payments.status` | Meaning |
| --- | --- |
| `CAPTURED` | Counts toward balance |
| `FAILED` | Soft fail record |
| `REFUNDED` | Linked reversal (rare; prefer credit note) |

Invoice aggregates: `amount_paid`, `amount_credited`, `balance_due` (stored denormalized, recalculated on payment/credit).

### 2.8 Credit notes

| Field | Notes |
| --- | --- |
| `credit_notes` | org, invoice_id, credit_number (unique/org), amount, reason, status (`DRAFT`,`ISSUED`,`APPLIED`,`VOID`), currency |
| Rule | Amount ≤ remaining invoice balance (after payments) unless org allows over-credit with write-off flag |
| Effect | Reduces `balance_due`; may move invoice from PAID back only via explicit reopen policy (**Assumption:** credit against open balance only; PAID invoices use new adjustment credit without reopening unpaid status) |

### 2.9 Partial payments

- Multiple `payments` per invoice allowed
- Each payment `amount > 0` and `sum(CAPTURED) ≤ invoice.total - credited`
- Status machine updates invoice after each payment

### 2.10 Billable hours → invoice

| Source | Rule |
| --- | --- |
| Eligible | `timesheets.status = APPROVED` AND `time_entries.billable = true` AND `time_entries.deleted_at IS NULL` |
| Amount | `hours × coalesce(entry.billing_rate, allocation.billing_rate, resource.billing_rate)` |
| Link | `invoice_items.time_entry_id` UNIQUE when not null — **one entry invoiced once** |
| Guard | Cannot invoice another org’s entry; cannot invoice unapproved sheet |

### 2.11 Finance tables (DDL intent)

#### `tax_rates`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| organization_id | uuid NOT NULL | |
| name | varchar(128) NOT NULL | |
| rate | numeric(8,4) NOT NULL | percent |
| tax_type | varchar(16) NOT NULL | CGST/SGST/IGST/VAT/OTHER |
| hsn_sac | varchar(32) | optional |
| effective_from | date | |
| effective_to | date | |
| is_active | boolean NOT NULL DEFAULT true | |
| deleted_at | timestamptz | |

#### `invoice_number_sequences`

| organization_id | fiscal_year | next_value |

PK `(organization_id, fiscal_year)`.

#### `invoices`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| organization_id | uuid NOT NULL | |
| region_id | uuid NOT NULL | from account/project |
| account_id | uuid NOT NULL | |
| project_id | uuid | |
| deal_id | uuid | |
| contract_id | uuid | |
| invoice_number | varchar(64) | null while DRAFT |
| status | varchar(32) NOT NULL | |
| issue_date | date | |
| due_date | date | |
| currency | char(3) NOT NULL | |
| subtotal | numeric(18,2) NOT NULL | |
| tax_total | numeric(18,2) NOT NULL | |
| total | numeric(18,2) NOT NULL | |
| amount_paid | numeric(18,2) NOT NULL DEFAULT 0 | |
| amount_credited | numeric(18,2) NOT NULL DEFAULT 0 | |
| balance_due | numeric(18,2) NOT NULL | |
| payment_terms_days | int | |
| place_of_supply | varchar(64) | |
| notes | text | |
| issued_by | uuid | |
| version | bigint | optimistic lock |
| soft-delete + audit columns | | |

Unique: `(organization_id, invoice_number)` WHERE `invoice_number IS NOT NULL AND deleted_at IS NULL`.

#### `invoice_items`

| Column | Notes |
| --- | --- |
| invoice_id | FK |
| line_no | int |
| description | |
| quantity | numeric(18,4) |
| unit_price | numeric(18,2) |
| amount | numeric(18,2) pretax or as policy |
| tax_inclusive | boolean |
| time_entry_id | unique when set |
| project_id | optional |
| hsn_sac | optional |

#### `invoice_item_taxes`

| invoice_item_id | tax_rate_id | tax_type | rate | tax_amount |

#### `payments`

| invoice_id | amount | paid_at | method | reference | status | received_by |

#### `credit_notes` / `credit_note_items` (optional line detail)

Minimal V2: header-only credit notes; line detail deferred if needed.

---

## 3. Procurement

### 3.1 Chain

```text
Vendor (procurement party)
  └── PurchaseOrder
        └── PurchaseOrderItem
              └── optional Project (cost attribution)
                    └── optional Expense (when goods/services received as project cost)
```

**Assumption:** `vendors` is the procurement master. `accounts.account_type = VENDOR` may optionally link via `vendors.account_id` but is not required.

### 3.2 Tables

#### `vendors`

org, region_id, name, tax_number, email, phone, account_id nullable, payment_terms_days, status (`ACTIVE`,`INACTIVE`), soft delete.

#### `purchase_orders`

org, region_id, vendor_id, project_id nullable, requester_id, status, currency, subtotal, tax_total, total, needed_by, approved_at, approved_by, notes.

**Statuses:** `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SENT`, `PARTIAL_RECEIVED`, `CLOSED`, `CANCELLED`.

#### `purchase_order_items`

po_id, description, quantity, unit_price, amount, tax_rate_id nullable, received_qty default 0.

#### Link to expenses

Optional `expenses.purchase_order_id` for “PO receipt → expense” later; not mandatory in first procurement slice.

---

## 4. Expenses

### 4.1 Chain

```text
Employee (Resource.user_id)
  └── Expense
        ├── ExpenseItem[]
        ├── Project (optional)
        └── ApprovalRequest (engine) OR MVP-style approve columns until engine lands
```

### 4.2 Tables

#### `expenses`

| Column | Notes |
| --- | --- |
| organization_id, region_id | |
| resource_id | submitter’s resource |
| project_id | optional |
| purchase_order_id | optional |
| expense_type | `EMPLOYEE`, `PROJECT`, `TRAVEL` |
| status | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `REIMBURSED` |
| incurred_on | date |
| currency | char(3) |
| total | numeric(18,2) |
| approval_request_id | nullable FK when engine exists |

#### `expense_items`

expense_id, category, description, amount, tax_amount, document_id (receipt).

---

## 5. Contracts

### 5.1 Chain

```text
Account
  └── Contract
        ├── Project[] (projects.contract_id nullable FK — **MVP alteration**)
        └── Renewal / expiry notifications
```

### 5.2 Tables

#### `contracts`

org, region_id, account_id, name, contract_number, value, currency, start_date, end_date, renewal_date, auto_renew boolean, payment_terms_days, status (`DRAFT`,`ACTIVE`,`EXPIRED`,`TERMINATED`,`RENEWED`), owner_id, notes.

#### Alterations to MVP

| Change | Why |
| --- | --- |
| `projects.contract_id` nullable UUID | Tie delivery to commercial agreement |
| `invoices.contract_id` nullable | Billing under contract |

#### Renewal / expiry

- Scheduler job: contracts with `end_date` or `renewal_date` within N days → `notifications` to owner + CONTRACT_MANAGE users
- Optional `contract_reminders_sent` to avoid duplicates

---

## 6. Profitability (derived, not a single table)

```text
Project Revenue
  = sum(invoice.total for project) − sum(applied credits)
− Resource Cost
  = sum(approved time_entry.hours × cost_rate snapshot)
− Project Expenses
  = sum(approved expense.total where project_id = project)
= Project Profit
```

| Cost rate source | Priority |
| --- | --- |
| 1 | `resource_allocations.cost_rate` overlapping entry date |
| 2 | `resources.cost_rate` |

**Reporting views (optional materialized later):**

- `v_project_profitability` (SQL view first)
- Requires `RATE_VIEW` / `REPORT_VIEW` to expose cost; portal never sees cost

**Billing amount from timesheets:**

```text
BillableAmount = sum(hours × billing_rate) for APPROVED + billable entries
InvoicedAmount = sum(invoice_items linked to those entries)
UnbilledAmount = BillableAmount − InvoicedAmount
```

---

## 7. Workflow engine tables

| Table | Columns (intent) |
| --- | --- |
| `workflow_definitions` | org, name, entity_type, enabled, version |
| `workflow_triggers` | workflow_id, event_type (e.g. `DEAL_STAGE_CHANGED`) |
| `workflow_conditions` | trigger_id, field_path, operator, value_json, sort_order |
| `workflow_actions` | trigger_id, action_type, config_json, sort_order |
| `domain_events` | org, event_type, aggregate_type, aggregate_id, payload jsonb, created_at, processed_at, error |
| `workflow_runs` | workflow_id, event_id, status, started_at, finished_at |

**Action types (initial):** `NOTIFY`, `CREATE_PROJECT`, `CREATE_TASK`, `CREATE_APPROVAL_REQUEST`, `UPDATE_FIELD`, `WEBHOOK` (later).

MVP today uses Spring application events in-process; V2 should **persist** `domain_events` (outbox) for reliability.

---

## 8. Approval engine tables

| Table | Purpose |
| --- | --- |
| `approval_workflows` | org, target_type, name, active |
| `approval_steps` | workflow_id, sort_order, mode (`SEQUENTIAL`/`PARALLEL`), approver_type, approver_ref (uuid or role code) |
| `approval_requests` | org, workflow_id, target_type, target_id, status, requested_by, created_at |
| `approval_actions` | request_id, step_id, actor_id, action (`APPROVE`/`REJECT`/`COMMENT`), comment, acted_at |

**Approver types:** `USER`, `ROLE`, `MANAGER`, `DEPARTMENT`, `REGION`.

**Target types:** `TIMESHEET`, `PURCHASE_ORDER`, `EXPENSE`, `INVOICE`, `DEAL`, `RESOURCE_ALLOCATION`.

**Migration of timesheets:** Keep existing `timesheets.status` / `approved_by` as denormalized cache; add optional `approval_request_id`. Historical rows remain valid without backfill of engine rows.

---

## 9. Advanced resource management (schema deltas)

Mostly indexes/views + optional tables:

| Addition | Purpose |
| --- | --- |
| `resource_unavailable` / leave blocks | Calendar gaps |
| `skill` already MVP | Enhance proficiency queries |
| Materialized utilization daily snapshot | Reporting performance |
| `resource_forecasts` | Optional capacity planning |

No greenfield rewrite of allocations — extend.

---

## 10. Customer portal (schema / auth)

| Addition | Purpose |
| --- | --- |
| `portal_users` | id, organization_id, account_id, email, password_hash, status, last_login |
| `portal_user_accounts` | if one login may see multiple accounts (optional; **Assumption:** 1 portal user ↔ 1 account for V2) |
| `documents.visibility` | MVP column already supports `CUSTOMER` |
| JWT claim `aud=portal` + `account_id` | Separate from internal tokens |

Prefer **not** putting portal users in `users` with a flag mixed into internal RBAC — clearer security boundary.

---

## 11. Organization / shared alterations

| Change | Module |
| --- | --- |
| `organizations.tax_number` | Finance/GST |
| `organization_settings` or columns: default_payment_terms_days, invoice_prefix, fiscal_year_start_month | Finance |
| `projects.contract_id` | Contracts |
| `audit_logs.region_id` | Security residual + V2 regional finance |
| `domain_events` | Workflow |
| `time_entries.invoiced_at` / flag | Optional denormalized; unique on invoice_items.time_entry_id may suffice |
| Permissions seed expansion | All V2 modules |

---

## 12. Indexing checklist (V2)

- `invoices (organization_id, status, issue_date)`
- `invoices (organization_id, account_id)`
- `invoice_items (time_entry_id)` unique partial
- `payments (invoice_id)`
- `purchase_orders (organization_id, vendor_id, status)`
- `expenses (organization_id, resource_id, status)`
- `contracts (organization_id, account_id, end_date)`
- `domain_events (processed_at) WHERE processed_at IS NULL`
- `approval_requests (target_type, target_id)`

---

## 13. What MVP must not break

Stable for V2 FKs:

- `accounts`, `projects`, `deals`, `timesheets`, `time_entries.billable`, `billing_rate`
- `resources.cost_rate` / `billing_rate`, allocation rate snapshots
- `documents` polymorphic entity_type/entity_id + visibility
- Permission codes expandable without role name hard-coding
