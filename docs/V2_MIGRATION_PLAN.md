# V2 Migration Plan

**Status:** Planning — no production business logic changes in Phase 12.  
**Related:** [V2_DATABASE_DESIGN.md](./V2_DATABASE_DESIGN.md), [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md), [V2_API_DESIGN.md](./V2_API_DESIGN.md), [V2_SECURITY_MODEL.md](./V2_SECURITY_MODEL.md), [V2_ROADMAP.md](./V2_ROADMAP.md)

---

## 1. Migration philosophy

1. **Additive Flyway only** — new tables/columns; avoid destructive renames  
2. **Backward compatible APIs** — additive DTO fields  
3. **Feature flags / permissions** — hide UI until module ready  
4. **Dual-run approvals** — timesheet legacy columns remain source of truth until cutover  
5. **No big-bang** — ship Finance before Portal; engines before rewriting every approve button  

---

## 2. Prerequisites (pre-V2 hardening + CRM foundation)

Complete before first customer-facing Finance deploy:

| Item | Risk if skipped |
| --- | --- |
| Documents upload/download | Expenses & portal blocked; Zoho-like attachments absent |
| CRM FilterEngine + list UI | Cannot claim list-view parity; ops unusable at scale |
| Saved views v1 | Reps cannot recreate Zoho daily workflows |
| `audit_logs.region_id` + filter | Regional AR leakage |
| Swagger disabled in prod | Surface area |
| Cluster-safe login rate limit | Brute force |
| Browser smoke of MVP golden path | Regressions under V2 load |

Recommended immediately after / overlapping: Notes+timeline, FLS for rates, RecordShell, bulk assign (see [V2_PRODUCT_ARCHITECTURE_REVIEW.md](./V2_PRODUCT_ARCHITECTURE_REVIEW.md)).

---

## 3. Suggested Flyway sequence (illustrative)

| Migration | Content |
| --- | --- |
| V16 | `organization` tax/settings columns; `audit_logs.region_id` if not done |
| V17 | `domain_events`, `workflow_*` (can land early empty) |
| V18 | `approval_*` tables |
| V19 | `tax_rates`, `invoice_number_sequences`, `invoices`, `invoice_items`, `invoice_item_taxes`, `payments`, `credit_notes` |
| V20 | `vendors`, `purchase_orders`, `purchase_order_items` |
| V21 | `expenses`, `expense_items` |
| V22 | `contracts`; `projects.contract_id`; `invoices.contract_id` |
| V23 | `portal_users` (+ indexes) |
| V24 | Advanced resource extras (unavailability) as needed |
| V25 | Permission seed for V2 codes; role grants |

Exact numbers depend on whether hardening uses V16 first.

---

## 4. Existing modules requiring modification

| Module | Modification |
| --- | --- |
| **Timesheet** | Unbilled query; prevent edit of invoiced entries; optional `approval_request_id`; publish richer events |
| **Project** | `contract_id`; profitability read API; sidebar links to invoices/expenses |
| **Account** | Child lists: contracts, invoices; tax profile completeness |
| **Resource / Allocation** | Cost rates fed into profitability; calendar extensions |
| **Deal** | Optional workflow auto-project (behavior change behind flag) |
| **Notification** | New types (invoice overdue, contract expiry, approval inbox) |
| **Document** | Implement MVP stub — blocking dependency |
| **Auth** | Portal audience, cookie names, `CurrentUser` vs `PortalUser` |
| **TenantAccess / AccessGuard** | Portal principal type; finance entity security adapters |
| **Dashboard / Search** | Index invoices/contracts/POs; AR cards |
| **Frontend shell** | Enable Finance/Contracts/Procurement nav by permission |
| **Seed / roles** | FINANCE_USER permissions activate for real |
| **Scheduler** | New jobs alongside overdue tasks |

---

## 5. New modules

| Module | Package / feature |
| --- | --- |
| Finance | `finance/` |
| Procurement | `procurement/` |
| Expenses | `expense/` |
| Contracts | `contract/` |
| Workflow | `workflow/` |
| Approval | `approval/` |
| Reports | `report/` |
| Portal | `portal/` + `frontend/src/features/portal` |
| Advanced resources | extensions under `resource/` |

---

## 6. Dependency order

```text
Documents (MVP gap)
    │
    ├──────────────────┐
    ▼                  ▼
domain_events     Approval engine (skeleton)
    │                  │
    ▼                  │
Workflow engine ◄──────┤  (actions may create approval requests)
    │                  │
    ▼                  ▼
Finance ◄──────── timesheet billable data (MVP)
    │
    ├─► Reporting (receivables, profitability) [needs cost rates]
    │
Procurement ──► (uses Approval)
Expenses ─────► (uses Approval + Documents)
Contracts ────► (reminders; links Project/Invoice)
    │
    ▼
Customer Portal (needs Finance invoices + Documents visibility)
Advanced Resource reports (can parallelize earlier)
```

**Critical path:** Documents → CRM Foundation (filters/views) → Finance → Portal.  
**Approval skeleton** should precede PO/Expense approve UX if avoiding throwaway approve endpoints — or ship thin approve then migrate (see roadmap).

---

## 7. Recommended V2 implementation sequence

| Step | Name | Deliverable |
| ---: | --- | --- |
| 0 | Hardening | Documents, audit region, swagger/rate-limit, smoke E2E |
| 0b | CRM Foundation | FilterEngine, SavedViews, RecordShell, Notes/Timeline |
| 0c | FLS (rates) | Field permission for cost/billing exposure |
| 1 | Outbox + Workflow skeleton | `domain_events`, CRUD definitions, no heavy actions |
| 2 | Approval engine skeleton | Tables + timesheet adapter dual-write |
| 3 | **Finance** | Tax, invoices, billable pull, payments, credit notes |
| 4 | Contracts | CRUD + project link + expiry reminders |
| 5 | Expenses | + documents receipts + approval |
| 6 | Procurement | Vendors + PO + approval |
| 7 | Profitability & reports | SQL reports + UI |
| 8 | Advanced resources | Calendar / forecast enhancements |
| 9 | Workflow actions pack | Auto-project on WON, notify packs |
| 10 | **Customer portal** | Auth + read APIs + UI |
| 11 | Cutover | Timesheet/PO/Expense approve 100% via engine; remove thin endpoints if desired |

This reorders the numeric V2_ROADMAP: **CRM Foundation before Finance**; **Approval/Outbox before PO/Expense**; **Portal last**.

---

## 8. Migration risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Invoicing before unique time_entry guard | Double billing | Partial unique index from day one |
| Backfilling invoice numbers | Collisions | Sequence table; no manual gaps fill |
| Soft-deleted accounts on open invoices | Broken AR | Restrict account delete if open balance |
| Approval dual-write drift | Status mismatch | Single writer service; integration tests |
| Large outbox backlog | Delayed automation | Indexed poller; alert on lag |
| Adding NOT NULL columns without defaults | Deploy fail | Nullable first, backfill, then constrain |
| Portal users in `users` table | Privilege mix-ups | Separate `portal_users` |
| Cost rates null on historical entries | Wrong profit | Document formula; exclude nulls or use allocation snapshot |
| Multi-region invoice without region_id | Leakage | Mandatory region_id on insert |
| Long-running Flyway on hot tables | Lock | Online-friendly indexes (`CONCURRENTLY` ops process if needed) |

---

## 9. Security risks (migration-time)

| Risk | Mitigation |
| --- | --- |
| Enabling Finance UI before permission seed | Gate nav on permissions; deny by default |
| Portal shipped with internal token accepted | Separate filter chain / audience validator |
| Temporary “god” finance role in seed left in prod | Review role_permissions each release |
| Credit note without audit | Mandatory audit on ISSUE/APPLY |
| Workflow action creating cross-tenant project | Org forced from event |

---

## 10. Data backfill expectations

| Data | Backfill? |
| --- | --- |
| Historical timesheets → invoices | **No** automatic; finance creates going forward |
| Approval_requests for old timesheets | **No** |
| Contracts for existing accounts | Manual/CSV optional |
| Portal users | Explicit invite |
| domain_events history | **No** |

---

## 11. Rollback strategy

- Feature flag / permission off hides UI  
- New tables can remain empty  
- Do **not** remove MVP approve columns in the same release as engine enable  
- Flyway undo not assumed — forward-fix migrations only  

---

## 12. Success criteria for V2 Phase 1 (Finance)

Golden path:

```text
Approved billable TimeEntry → Invoice draft → Issue → Partial Payment → Paid
+ Credit note on issued invoice
+ Cross-org IDOR tests green
+ Regional admin cannot see other region invoices
```

---

## 13. Traceability

| Topic | Doc |
| --- | --- |
| Tables | V2_DATABASE_DESIGN |
| Runtime design | V2_ARCHITECTURE |
| HTTP contracts | V2_API_DESIGN |
| Portal boundary / RBAC | V2_SECURITY_MODEL |
| Phase names (legacy numbering) | V2_ROADMAP |
