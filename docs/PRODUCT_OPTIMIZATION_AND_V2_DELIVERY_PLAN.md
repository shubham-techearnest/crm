# TechEarnest CRM — Product Optimization & V2 Delivery Plan

**Document type:** Single source of truth for product + architecture delivery  
**Audience:** Product Owner, Engineering, QA, Design  
**Companion backlog:** [TECH_EARNEST_CRM_SPRINT_BACKLOG.xlsx](./TECH_EARNEST_CRM_SPRINT_BACKLOG.xlsx) (if locked in Excel, use [TECH_EARNEST_CRM_SPRINT_BACKLOG_v2.xlsx](./TECH_EARNEST_CRM_SPRINT_BACKLOG_v2.xlsx) until you replace the primary file)  
**Status:** Ready for execution (planning complete — includes Metadata & ACL Studio)  
**Date:** 2026-09-22 (rev 2 — ServiceNow-style admin)  

---

## 1. Executive product decision

### 1.1 Two operating worlds (must not be mixed)

| World | Actor | Job to be done | Sees org CRM Leads? |
| --- | --- | --- | --- |
| **Platform (SaaS ops)** | Super Admin | Sell & operate TechEarnest CRM: create organizations, subscriptions, billing of *our* software, platform health, support | **No** — not as tenant pipeline |
| **Tenant (customer org)** | Org Admin + roles | Run their own CRM → Project → Resource → Time → Finance | **Yes** — their leads only |

**Principle:** Super Admin manages **organizations as customers of TechEarnest**. Organization users manage **their own sales leads** for *their* business.

### 1.2 Super Admin product surface (new / clarified)

Super Admin works in a **Platform Console** (separate nav/layout from tenant CRM):

1. **Organizations** — create, suspend, activate, configure plan limits  
2. **Platform prospects / opportunities** (optional module name: *Prospect Orgs* or *Sales Pipeline*) — track who we are selling TechEarnest CRM to (this is **not** tenant `Leads`)  
3. **Subscriptions & commercial terms** (V2+) — plan, seats, contract dates  
4. **Platform users** — Super Admins / support operators  
5. **Cross-org health** — usage counts, login failures, migration status (aggregated, privacy-safe)  
6. **Global settings** — feature flags, default tax templates, email provider (platform-level)  
7. **Audit** — platform-scoped actions (org create/suspend, impersonation if ever allowed — prefer support tools without impersonation in V1)

**Explicit non-goals for Super Admin in tenant CRM:**

- Do not land Super Admin on `/leads` of a random org by default  
- Do not edit tenant deals/contacts as part of daily SaaS ops  
- Cross-tenant data browsing only via deliberate Platform Console tools with full audit  

### 1.3 Organization product surface (tenant)

Organization owns a complete modular CRM + delivery suite:

Leads → Contacts → Accounts → Deals → Activities (Tasks / Meetings / Calls) → Documents → Projects → Tasks → Milestones → Resources → Allocation → Skills → Timesheets → Users / Roles / Regions / Departments / Settings / Audit  

**V2 adds:** Invoices, Payments, Credit Notes, Purchase Orders, Expenses, Contracts, Reports, (later) Customer Portal.

### 1.4 UX product goal

**High-level, rich, clutter-free, organized** — Zoho-like depth without Zoho clutter:

- One module list pattern everywhere (`ModuleListShell`)  
- Progressive disclosure on forms (sections / stepper / “More fields”)  
- Advanced filters per module (field + operator + value, saved views)  
- Record detail shell (Overview / Related / Activity / Notes / Documents / Audit)  
- Dense tables, calm navy+blue theme, no decorative noise  

### 1.5 ServiceNow-inspired configuration (product mandate)

Org Admins (and Super Admin for platform tables) must configure the application **without code**, in a user-friendly **Metadata & ACL Studio**:

| ServiceNow analogue | TechEarnest capability |
| --- | --- |
| Table Dictionary | **Module / Table registry** — every business entity is a configurable table |
| Dictionary / Columns | **Field Dictionary** — label, type, mandatory, default, reference, active |
| Form Designer | **Form Layout Designer** — sections, field order, progressive disclosure |
| List Layout / Personalize List | **List Layout Designer** — columns, order, width, default sort |
| ACL (CRUD) | **Table ACL matrix** — Create / Read / Update / Delete per role |
| Field ACL | **Field-level security (FLS)** — hide / read-only / write by role |
| UI Policies | **Form policies** — show/hide/require fields by condition (no scripts in V2) |
| Related Lists | **Related list layouts** on RecordShell |
| Application Menus | **Nav visibility** by role + order |

**Principle:** Runtime CRUD, list columns, form fields, and buttons are **driven by metadata + role ACL**, not hard-coded per screen forever. Seed defaults ship for all modules; Org Admin customizes safely within guardrails.

---

## 2. Current state vs target

| Area | Today | Target |
| --- | --- | --- |
| Super Admin | PLATFORM scope + mostly same CRM nav; can see org data with `organizationId` | Dedicated Platform Console; org CRM hidden |
| Org create | Permission `ORG_CREATE` exists; UX incomplete | Full multi-org create + onboarding wizard |
| Module UI | Shared list shell started | Same shell + RecordShell + form system on all modules |
| Forms | Flat, long forms; mostly code-defined | Sectioned kit **+** Form Layout Designer (metadata) |
| Lists | Columns mostly fixed in React | List Layout Designer + personal overrides |
| CRUD / roles | Permission codes exist; UX not table-ACL friendly | Full CRUD matrix UI; API + UI always enforce |
| Filters | Leads advanced; others basic | Module-specific advanced filter catalogs |
| Custom fields | Documented as hybrid | Field Dictionary + tenant custom fields |
| V2 Finance etc. | Docs + foundation only | Phased delivery per backlog workbook |

---

## 3. Architecture principles (Senior Architect)

1. **Remain modular monolith** — no microservices for V2  
2. **Tenant isolation** — every tenant API forces `organization_id` from JWT (except Platform Console APIs)  
3. **Platform APIs** under `/api/v1/platform/**` with PLATFORM scope only  
4. **Permission codes** expand without hard-coding roles  
5. **FilterEngine + SavedViews + Notes + Documents** are shared platform capabilities  
6. **Metadata-driven UI** — Table / Field / Form / List / ACL registries; code provides engine + seed defaults  
7. **Approval + Workflow engines** before rewriting every approve button  
8. **UI design system** — one shell, one form kit, one table kit, one Studio chrome  

### 3.1 Suggested package / route split

```text
/platform/*                 → Super Admin console (Organizations, Prospect Orgs, Platform Settings)
/api/v1/platform/*          → Platform APIs

/admin/studio/*             → Tenant Metadata & ACL Studio (Org Admin)
/api/v1/metadata/**         → Dictionary, form/list layouts, ACLs (org-scoped)
/api/v1/acl/**              → Effective permission evaluation helpers

/*                          → Tenant app (existing modules — layout driven by metadata)
/api/v1/*                   → Tenant APIs (org from JWT; CRUD gated by table ACL)
```

### 3.2 Security rules

| Rule | Enforcement |
| --- | --- |
| Super Admin never sees tenant lead list by default | Route + permission + nav |
| Org user never creates organizations | `ORG_CREATE` platform-only |
| Region scope stays server-side | Existing `TenantAccess` |
| Every mutate/read checks table ACL + data scope | Server-side ACL service (UI hide is not enough) |
| Field-level security for rates/margins + configurable FLS | FLS engine before Finance pilot |
| System fields cannot be deleted | Dictionary `system=true` flag |
| Portal users separate table + JWT audience | V2 Portal phase |

### 3.3 Metadata engine (high level)

```text
Seed defaults (Flyway)
        ↓
sys_table / sys_field / sys_form_layout / sys_list_layout / sys_table_acl / sys_field_acl
        ↓
Org overrides (tenant rows; never mutate platform seed in place)
        ↓
Effective layout resolver (role + user personalization)
        ↓
ModuleListShell + DynamicForm + RecordShell
```

**Guardrails (avoid ServiceNow sprawl):**

- No client scripts / server scripts in V2 — policies are declarative only  
- Custom fields: typed columns in JSONB/`custom_fields` map or EAV — pick one pattern in S8 spike and stick to it  
- Max custom fields per table (e.g. 50)  
- Layout changes audited  
- Preview mode before publish |

---

## 4. UX / Form / Filter optimization standard (all modules)

### 4.1 Universal list page (already started)

- Title + saved view dropdown  
- Filter rail (toggle)  
- Sort + List/Tile (+ Kanban where pipeline applies)  
- Create primary CTA  
- Total records footer  
- Row click → detail drawer or full RecordShell  

### 4.2 Universal create / edit form

Every create form must provide:

| Capability | Requirement |
| --- | --- |
| Sections | Identity / Classification / Commercial / Address / Notes |
| Required markers | Visible `*` |
| Inline validation | Client + server messages |
| Defaults | Status, currency, owner = current user, region = user’s primary |
| Lookup filters | Org + region + permission aware |
| Actions | Cancel, Save, Save & New (where useful) |
| Duplicate protection | Submit once; show progress |
| Unsaved changes | Confirm on navigate away |
| Responsive | Single column on mobile |

**Progressive disclosure:** show 6–8 primary fields first; “Additional details” expands secondary fields.

### 4.3 Advanced filters (per module catalog)

Shared operators: Equals, Not Equals, Contains, Starts With, Is Empty, In, Between, Before/After, Relative date, Current User, Current Region.

Each module defines **allowed fields** (whitelist) — see Sprint backlog epics `FLT-*`.

Examples:

| Module | Advanced filter examples |
| --- | --- |
| Leads | Status, Source, Priority, Owner, Region, Est. value range, Created, Unconverted, Has email |
| Contacts | Account, Status, Owner, Email domain, Designation |
| Accounts | Type, Status, Industry, Region, Has open deals |
| Deals | Stage, Value range, Close date, Account, Owner, Aging |
| Activities | Type, Status, Due (overdue/today/week), Related module |
| Projects | Status, Account, Manager, Date range, Delayed |
| Timesheets | Status, Week, Resource, Billable hours |
| Invoices (V2) | Status, Due, Overdue, Account, Balance |
| POs (V2) | Status, Vendor, Project, Approval state |
| Expenses (V2) | Category, Billable, Approval, Project |
| Contracts (V2) | Status, Expiry window, Account, Auto-renew |

### 4.4 Record detail (RecordShell)

Tabs: Overview | Related | Activities | Notes | Documents | Timeline/Audit  

Contextual actions by module (Convert, Change Stage, Create Project, Submit Timesheet, Send Invoice, etc.).

---

## 5. Module optimization plan (tenant)

### 5.1 CRM

| Module | Form optimization | Filter depth | Differentiator |
| --- | --- | --- | --- |
| Leads | Compact create; convert wizard polish | Full FilterEngine | Conversion + region |
| Contacts | Account-first; duplicate email warn | Account + status | Account related lists |
| Accounts | Type-driven sections | Type/status/industry | Hub for deals/projects |
| Deals | Stage-aware fields; value currency | Pipeline + aging | List + Kanban |
| Activities | Type templates (Task/Call/Meeting) | Type due/status | Split nav already |

### 5.2 Collaboration

| Module | Plan |
| --- | --- |
| Documents | Module library + attach from record; visibility INTERNAL/CUSTOMER |
| Notes | Everywhere on RecordShell |
| Meetings/Calls | Rich activity fields: attendees, outcome, duration (incremental) |

### 5.3 Delivery

| Module | Plan |
| --- | --- |
| Projects | Create from Deal; health indicators |
| Project Tasks | Dependency-aware status rules |
| Milestones | Date + % complete |
| Resources / Skills / Allocation | Utilization + over-allocation warnings |
| Timesheets | Submit/approve UX polish; link billable to Finance later |

### 5.4 Admin (tenant)

Users, Roles, Regions, Departments, Settings, Audit — cleaner forms, scoped lists, no platform clutter.

### 5.5 Metadata & ACL Studio (ServiceNow-like — all modules)

**Who:** Org Admin configures tenant; Super Admin may manage platform-default seeds only (not tenant CRM data).

| Studio area | User-friendly capability | Applies to |
| --- | --- | --- |
| **Tables** | Browse modules as tables; active flag; label; plural label | All business modules |
| **Fields** | Add/edit field: type, label, help text, mandatory, default, reference target, active | System + custom |
| **Form layouts** | Drag sections/fields; set primary vs “Additional details”; per-role variant optional | Create + Edit |
| **List layouts** | Choose columns, order, freeze, default sort; role default + personalize | Every list |
| **Related lists** | Which related tabs/lists appear on RecordShell and column set | Record detail |
| **Table ACLs** | Matrix: Role × Table × Create/Read/Update/Delete (checkboxes) | Full CRUD |
| **Field ACLs** | Role × Field × Hidden / Read / Write | Sensitive + custom |
| **Form policies** | If condition → set visible/mandatory/read-only (declarative) | Key CRM + Finance forms |
| **Nav modules** | Show/hide module in sidebar by role; reorder groups | App shell |

**CRUD product rule:** For every module (Leads … Audit, plus V2 Finance), Create / View / Edit / Delete (and soft actions like Cancel/Void where applicable) obey **table ACL + permission code + data scope**. Buttons hidden when denied; API still returns 403.

**UX for Studio:** Clutter-free — left nav of tables, center designer canvas, right property inspector; publish + discard draft; always Preview with sample role.

---

## 6. Platform Console plan (Super Admin)

### Sprint focus (see Excel)

1. Platform layout + hide tenant CRM for SUPER_ADMIN  
2. Organizations CRUD + create wizard (name, slug, admin user, region seed)  
3. Organization lifecycle (ACTIVE / SUSPENDED)  
4. Prospect Orgs / SaaS sales pipeline (fields: company, stage, ARR estimate, owner)  
5. Platform dashboard (org count, active users, MRR placeholder)  
6. Ability to open a tenant in **support read-only** mode only if product later approves (default: **out of V2** — EXCLUDE impersonation unless required)

---

## 7. V2 commercial modules

| Module | Core capability | Dependency |
| --- | --- | --- |
| Invoices + Taxes + Payments + Credit Notes | Sales-to-cash | Billable timesheets, Accounts |
| Purchase Orders + Vendors | Controlled spend | Approval skeleton |
| Expenses | Project/employee spend | Documents + Approval |
| Contracts | Commercial agreements | Accounts; reminders |
| Reports | Sales, delivery, AR, profitability | Finance + rates FLS |
| Customer Portal | External least privilege | Invoices + Documents visibility |

**Delivery order (validated):** Foundation → Platform Console split → Form/Filter/RecordShell polish → **Metadata & ACL Studio** → CRM depth → Approval/Outbox → Finance → Contracts → Expenses → Procurement → Reports → Portal.

New V2 modules (Invoices, POs, etc.) **must register** table/fields/default form+list layouts + ACLs in the same Studio — no one-off hard-coded admin.

Engineering checklist + invoice stub sample: [MODULE_ONBOARDING_DoD.md](./MODULE_ONBOARDING_DoD.md).

---

## 8. Delivery program structure

### 8.1 Program phases → sprints

| Phase | Intent | Suggested sprints |
| --- | --- | --- |
| P0 | Platform vs Tenant split + Super Admin org management | S1–S3 |
| P1 | UX system: forms, RecordShell, advanced filters all live modules | S4–S7 |
| **P2** | **Metadata & ACL Studio** (tables, fields, forms, lists, CRUD matrix, FLS) | **S8–S11** |
| P3 | CRM/ops depth (bulk, duplicates, meeting richness) | S12–S13 |
| P4 | Engines (Approval + Workflow skeleton) | S14–S15 |
| P5 | Finance | S16–S18 |
| P6 | Contracts + Expenses | S19–S20 |
| P7 | Procurement | S21–S22 |
| P8 | Reports + Profitability | S23–S24 |
| P9 | Customer Portal + hardening | S25–S26 |

Sprint length assumption: **2 weeks**. Adjust in Excel if needed.

### 8.2 Definition of Done (every story)

- UI + API + DB (if needed) + validation + authorization + audit (where required)  
- Org isolation tests for new APIs  
- Empty / loading / error / forbidden states  
- **ACL:** create/read/update/delete (or field visibility) verified for at least two roles  
- Entry in Excel Status → Done  

### 8.3 How we use the Excel workbook

1. Pick next Sprint sheet / filter Status = Not Started  
2. Pull stories into implementation **sequentially by Sprint**  
3. Update **Status**, **Owner**, **Updated On** in Excel  
4. Do not invent scope outside the backlog without a new story row  

---

## 9. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Super Admin still using tenant Leads | Platform Console gate in S1 |
| Form rewrite stalls V2 Finance | Form kit first; Studio layouts bind to kit; Finance uses both |
| Filter explosion | Whitelist fields per module (dictionary-driven) |
| ServiceNow-level complexity / sprawl | Declarative policies only; caps on custom fields; no scripts in V2 |
| ACL misconfig locks out admins | Org Admin always retains `ROLE_MANAGE` + Studio access; bootstrap seed ACL |
| Over-building Zoho clones | Follow PRODUCT_SCOPE_DECISION_MATRIX exclusions |
| Approval dual-write drift | Single writer service + tests |

---

## 10. Explicit exclusions (still)

Marketing automation, full accounting/GL, payroll/HRMS, mobile apps, partner portal, AI/Zia, Zoho Canvas, Kafka/microservices, **ServiceNow-style client/server scripts**, full Flow Designer — unless later re-scoped.

---

## 11. Immediate next execution (after plan approval)

1. Implement **Sprint 1** from Excel (Platform Console shell + Super Admin nav split)  
2. Organizations create wizard (S2) → Prospect Orgs (S3)  
3. Form/filter kit (S4–S7)  
4. **Metadata & ACL Studio (S8–S11)** — before deepening CRM and before Finance  
5. Then sequential sprints through Portal (S26)  

---

## 12. Document control

| Item | Value |
| --- | --- |
| Plan file | `docs/PRODUCT_OPTIMIZATION_AND_V2_DELIVERY_PLAN.md` |
| Backlog file | `docs/TECH_EARNEST_CRM_SPRINT_BACKLOG.xlsx` (latest regen also at `_v2.xlsx` if primary locked) |
| Generator | `docs/generate-sprint-backlog.js` |
| Story count | 128 (S1–S26 through V2) |
| Related | `V2_PRODUCT_ARCHITECTURE_REVIEW.md`, `V2_ROADMAP.md`, `ROLE_PERMISSION_MATRIX.md`, `ZOHO_*` matrices |

**Approval gate:** Product Owner confirms (1) Super Admin does not use tenant Leads; (2) Org Admin gets ServiceNow-like Studio for tables/forms/lists/ACLs. Then engineering executes Sprint 1 onward sequentially.

**Sprint QA folder:** [all-sprint-testing/](./all-sprint-testing/) — one checklist file per sprint  
**Latest:** [Sprint-2-QA-Organizations.md](./all-sprint-testing/Sprint-2-QA-Organizations.md)
