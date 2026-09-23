# V2 Product & Architecture Review (Executive Blueprint)

**Phase:** 12 — V2 Architecture + Zoho CRM Parity + Product Gap Analysis  
**Date:** 2026-09-21  
**Implementation:** **None** (analysis & documentation only)  
**Evidence:** Live repository inspection + official Zoho CRM Help (listed in [ZOHO_PARITY_MATRIX.md](./ZOHO_PARITY_MATRIX.md))  
**Prior V2 design:** [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md), [V2_DATABASE_DESIGN.md](./V2_DATABASE_DESIGN.md), [V2_API_DESIGN.md](./V2_API_DESIGN.md), [V2_SECURITY_MODEL.md](./V2_SECURITY_MODEL.md), [V2_MIGRATION_PLAN.md](./V2_MIGRATION_PLAN.md)

---

## Implementation gate

### READY WITH CONDITIONS

V2 Finance **must not** start until **P0 foundation** items below are complete (or explicitly waived with risk acceptance). Modular monolith is sound; CRM platform depth is the blocker for “Zoho-like” claims, not the ability to add invoice tables.

**Conditions (P0):**

1. Documents upload/download API + UI (table already exists)  
2. CRM list **filter + sort UI** wired to APIs  
3. **Saved views** v1 (private filters + columns)  
4. Production hygiene: Swagger off, rate-limit hardening, audit `region_id` path  

**Strongly recommended before Finance customer pilot (P1):** Notes/timeline, FLS for rates, Record detail shell, bulk assign.

---

## 1. Current architecture assessment

| Aspect | Assessment |
| --- | --- |
| Style | Modular monolith (Spring Boot 3 / Java 21 + React/Vite) — **appropriate** |
| Boundaries | Package-by-domain; shared `common.security` — healthy |
| Coupling | Acceptable; convert orchestrates account/contact/deal |
| Tenancy | Shared schema + `organization_id` — proven in tests |
| Extension | `domain_events` stub ready for outbox; do not need Kafka |
| Microservices | **Not recommended** for V2 |

## 2. Current CRM maturity

| Layer | Maturity |
| --- | --- |
| Domain model (Lead/Account/Contact/Deal/Activity) | **High** |
| Security scopes | **High** (TEAM fixed Phase 11) |
| Conversion / pipeline | **High** |
| List UX / filters / views | **Low** |
| Collaboration (notes, files, timeline) | **Low** |
| Automation | **Very low** (timesheet only) |
| Overall CRM-as-Zoho-alternative | **Mid** — strong core, thin platform |

Approximate matrix coverages (documented denominators in child docs): Fields usable ~60%+ core; Functions ~48%; Views ~25%; Filters ~19%; UX ~43%; Permissions ~60%; Automation ~10%.

## 3. Zoho parity summary

| Band | Examples |
| --- | --- |
| Present | CRUD modules, convert, owner, pipeline, search, dashboards, RBAC |
| Partial | Activities, related lists, export/import, addresses, TEAM/roles |
| Missing (in-scope) | Saved views, advanced filters, notes, attachments API, bulk, custom fields, FLS, workflow, multi-step approval |
| Excluded | Campaigns, CPQ, Canvas, Zia, Cadences, email client |

## 4–14. Gap summaries

| # | Area | Verdict |
| --- | --- | --- |
| 4 | CRM modules | Entities strong; UX/platform weak |
| 5 | Fields | Core OK; addresses/tags/notes/custom missing |
| 6 | Validation | Basic strong; conditional/duplicate weak |
| 7 | Filters | Critical gap — build shared engine |
| 8 | Views | List+deal pipeline only |
| 9 | UI/UX | Shell inconsistent; no RecordShell |
| 10 | Search | Global OK; module UI missing |
| 11 | Bulk | Essentially absent |
| 12 | Permissions | Module+scope OK; FLS missing |
| 13 | Automation | Stub only |
| 14 | Reporting | Cards only |

## 15–22. V2 domain architectures (design only)

Summaries — details in V2_* docs:

| Domain | Design spine |
| --- | --- |
| 15 Finance | Account→Contract?→Project→Approved billable TimeEntry→Invoice→Payment (+ CreditNote); GST-ready tax lines; number on ISSUE |
| 16 Procurement | Vendor→PO→Items→Project; approval engine; optional expense |
| 17 Expenses | Resource→Expense→Project→Approval; receipts via Documents |
| 18 Contracts | Account→Contract→Project/Invoice; renewals + reminders |
| 19 Advanced resources | Calendar unavailability + utilization reports on MVP allocations |
| 20 Approval | Workflows/steps/requests/actions; USER/ROLE/MANAGER/DEPT/REGION |
| 21 Workflow | Definition→Trigger→Condition→Action on `domain_events` outbox |
| 22 Portal | `portal_users` + `aud=portal` + `/api/v1/portal`; account-scoped; never cost/margin |

## 23. Database changes

**Existing table alters:** `projects.contract_id`, org tax/settings, `audit_logs.region_id`, optional `approval_request_id` on timesheets, invoice FKs later.  

**New tables:** finance set, vendors/POs, expenses, contracts, workflow_*, approval_*, portal_users, custom_field_*, saved_views, notes (CRM foundation), document API uses existing `documents`.

## 24. API changes

Additive `/api/v1` resources per [V2_API_DESIGN.md](./V2_API_DESIGN.md); portal prefix isolated; generic `POST /query` or filter JSON on list endpoints for FilterEngine.

## 25. Security changes

Portal audience separation; FLS; region on financial entities; unique `time_entry` invoicing; lookup endpoints must apply TenantAccess.

## 26. Migration risks

Double-billing; approval dual-write; NOT NULL backfills; portal user mix-up; outbox lag — see [V2_MIGRATION_PLAN.md](./V2_MIGRATION_PLAN.md).

## 27. Performance risks

Advanced filters, related lists, profitability reports, bulk export — index early; paginate always; async workflow.

## 28. Architecture blockers (P0)

1. Documents not implemented in app layer  
2. No reusable filter/saved-view platform (CRM parity blocker)  
3. Audit region filtering incomplete for regional finance  

## 29. Product blockers (P1)

Notes/timeline, bulk assign, conditional validation, FLS for rates, standardized record detail, export coverage.

## 30. Recommended V2 sequence (validated dependency graph)

```text
[0] Hardening + Documents
        ↓
[1] CRM Foundation — FilterEngine + SavedViews + RecordShell + Notes/Timeline
        ↓
[2] Security foundation — FLS (rates) + audit region_id
        ↓
[3] Outbox + Approval skeleton + Workflow skeleton (empty runners OK)
        ↓
[4] Finance (tax, invoice, payment, credit)  ← first commercial V2
        ↓
[5] Contracts
        ↓
[6] Expenses (needs Documents + Approval)
        ↓
[7] Procurement (needs Approval)
        ↓
[8] Advanced Resource + Profitability Reports
        ↓
[9] Workflow action packs (e..g. WON → project)
        ↓
[10] Customer Portal
```

**Change vs naive V2_ROADMAP order:** CRM Foundation **before** Finance; Approval/Outbox **before** PO/Expense; Portal **last**. Custom fields hybrid can parallelize after FilterEngine.

## 31. Product differentiators

Unified sales→cash→profit; regional hierarchy; resource cost × timesheet × expense profitability; one approval/workflow fabric; typed automations; portal hard isolation.

## 32. Explicitly excluded features

Campaigns, Cadences, CPQ/Quotes-as-billing, Canvas designer, Zia AI, full email/telephony, partner portal, payroll/HRMS/helpdesk, Kafka/microservices, multi-currency FX engine (V2 stays org single currency).

---

## Golden flows (readiness)

| Flow | Ready to design | Ready to build |
| --- | --- | --- |
| Sales→Cash | Yes | After Documents + Finance |
| Project Expense | Yes | After Documents + Approval + Expense |
| Procurement | Yes | After Approval + PO |
| Contract | Yes | After Contracts module |
| Profitability | Yes | After Finance + cost FLS |
| Generic Approval/Automation | Yes | After engine skeletons |

---

## Child documents index

| Doc | Role |
| --- | --- |
| [ZOHO_PARITY_MATRIX.md](./ZOHO_PARITY_MATRIX.md) | Capability matrix + sources + scorecard |
| [ZOHO_MODULE_FIELD_MATRIX.md](./ZOHO_MODULE_FIELD_MATRIX.md) | Fields |
| [ZOHO_FUNCTION_PARITY.md](./ZOHO_FUNCTION_PARITY.md) | Operations |
| [ZOHO_VIEW_FILTER_MATRIX.md](./ZOHO_VIEW_FILTER_MATRIX.md) | Views/filters |
| [ZOHO_UI_UX_PARITY.md](./ZOHO_UI_UX_PARITY.md) | UX |
| [ZOHO_VALIDATION_RULE_MATRIX.md](./ZOHO_VALIDATION_RULE_MATRIX.md) | Validation |
| [ZOHO_PERMISSION_PARITY.md](./ZOHO_PERMISSION_PARITY.md) | RBAC |
| [ZOHO_AUTOMATION_PARITY.md](./ZOHO_AUTOMATION_PARITY.md) | Workflow/approval |
| [CRM_PRODUCT_GAP_ANALYSIS.md](./CRM_PRODUCT_GAP_ANALYSIS.md) | Narrative gaps |
| [PRODUCT_SCOPE_DECISION_MATRIX.md](./PRODUCT_SCOPE_DECISION_MATRIX.md) | KEEP/ADD/EXCLUDE |
| V2_* set | Technical design |

---

## Final answer to “Is foundation mature enough?”

**Domain/security foundation: yes.**  
**CRM product-platform foundation: not yet for Zoho-like depth.**  
**V2 finance architecture: designed and compatible.**  

→ **READY WITH CONDITIONS.**
