# Zoho UI/UX Parity

Code evidence: React + Bootstrap feature pages under `frontend/src/features/*` (2026-09-21).  
Zoho UX references: module list/detail patterns [S2](https://www.zoho.com/one/guides/organizedata.html), [S3](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/managing-module-views/articles/list-view).

| Area | Zoho-like expectation | Current | Status | Priority | Decision |
| --- | --- | --- | --- | --- | --- |
| Sidebar module grouping | Sales / Projects / Finance | Flat routes by permission | PARTIAL | P1 | IMPROVE |
| Breadcrumbs | Module > Record | Weak | MISSING | P2 | ADD |
| Top bar global search | Yes | GlobalSearch component | EXISTING | — | KEEP |
| Quick create | + menu | No | MISSING | P1 | ADD |
| Notifications | Bell | Timesheet-driven only | PARTIAL | P1 | IMPROVE |
| User menu | Profile/logout | Present | EXISTING | — | KEEP |
| List header actions | New + views + filters | New/export uneven | PARTIAL | P0 | IMPROVE |
| List filters panel | Advanced filters | Absent | MISSING | P0 | ADD |
| Column config | Yes | Fixed | MISSING | P1 | ADD |
| Bulk action bar | Yes | Absent | MISSING | P1 | ADD |
| Pagination controls | Yes | Fetch size=100, weak UI | PARTIAL | P1 | IMPROVE |
| Record header | Name, status, owner, actions | Partial on Lead/Deal | PARTIAL | P1 | STANDARDIZE |
| Detail tabs | Overview/Related/Timeline | Ad-hoc panels | PARTIAL | P1 | ADD shell |
| Related lists | Full | Partial (Accounts) | PARTIAL | P1 | ADD |
| Timeline | Unified | Missing | MISSING | P1 | ADD |
| Modals | Confirm / forms | Mixed | PARTIAL | P2 | STANDARDIZE |
| Drawers | Record peek | Split columns | PARTIAL | P2 | IMPROVE |
| Toasts | Success/error | Alerts inline | PARTIAL | P2 | IMPROVE |
| Empty / Loading / Error | Required | CrmPage/AdminPage states | EXISTING | — | KEEP |
| Unauthorized / Forbidden | Clear | Redirect `/` | PARTIAL | P2 | IMPROVE message |
| Unsaved changes guard | Yes | No | MISSING | P1 | ADD |
| Save & New | Common | No | MISSING | P2 | ADD |
| Destructive confirm | Yes | Inconsistent | PARTIAL | P1 | STANDARDIZE |
| Responsive | Desktop+mobile | Basic Bootstrap | PARTIAL | P2 | IMPROVE |
| Accessibility / keyboard | Enterprise bar | Not audited | MISSING | P2 | ADD audit |
| Design system | Consistent primitives | FormField + ad-hoc tables | PARTIAL | P1 | ADD DS tokens |
| Canvas / visual designer | Zoho Canvas | — | NOT_REQUIRED | — | EXCLUDE |

### Record detail architecture (PART M) — recommended

Reusable `RecordShell`: Header (title, badges, primary/secondary actions) + Tabs (Overview, Related, Activity, Documents, Audit) + scoped data loaders. Apply to Lead, Account, Contact, Deal, Project, and later Invoice/Contract.

### Scorecard — UX

Denominator = 28 in-scope rows above (exclude NOT_REQUIRED).  
EXISTING≈4, PARTIAL≈16, MISSING≈8 → **(4+8)/28 ≈ 43%**.
