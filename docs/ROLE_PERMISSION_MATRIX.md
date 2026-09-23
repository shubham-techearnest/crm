# Role and Permission Matrix

Permissions are stored in the database and granted through roles. Controllers must not hard-code role names. Services check **permission codes** plus **data scope**.

Frontend may hide buttons using the same codes. Backend always enforces.

---

## 1. Data scope

Each role has a default `data_scope`. A user may later receive extra region/department/team assignments.

| Scope | Meaning |
| --- | --- |
| `PLATFORM` | All organizations |
| `ORGANIZATION` | All records in the user's organization |
| `REGION` | Records whose `region_id` is in the user's assigned regions |
| `DEPARTMENT` | Records in assigned departments (and typically the user's own) |
| `TEAM` | Records owned by or assigned to users in the user's teams, plus own |
| `OWN` | Records the user owns, is assigned to, or (for timesheets) that belong to their resource |

Scope never widens beyond the organization except `PLATFORM`.

---

## 2. Initial roles

| Code | Data scope | Intent |
| --- | --- | --- |
| `SUPER_ADMIN` | PLATFORM | Platform operator; manage organizations |
| `ORGANIZATION_ADMIN` | ORGANIZATION | Full admin inside one tenant |
| `REGIONAL_ADMIN` | REGION | Run one or more assigned regions |
| `SALES_MANAGER` | TEAM | Pipeline for their sales team |
| `SALES_EXECUTIVE` | OWN | Own leads/deals/activities |
| `PROJECT_MANAGER` | TEAM / project assignment | Projects they manage and related time approval |
| `RESOURCE_MANAGER` | ORGANIZATION or REGION | Capacity and allocations (org default; region if assigned) |
| `FINANCE_USER` | ORGANIZATION | Finance data (mostly V2); limited MVP dashboard |
| `EMPLOYEE` | OWN | Tasks and timesheets |
| `VIEWER` | ORGANIZATION or REGION | Read-only, still region-constrained if scope is REGION |

**Assumption:** `RESOURCE_MANAGER` defaults to `ORGANIZATION` so they can allocate across regions unless `user_regions` is populated, in which case they are region-limited. `PROJECT_MANAGER` sees projects where they are `project_manager_id` **or** team-scope records. `VIEWER` is read-only; never mutate.

A user may have multiple roles. Effective permissions are the **union**. Effective data scope is the **widest** of their roles, then still intersected with assigned regions if the resulting scope is `REGION` (or if `user_regions` is non-empty and the user is not org/platform scoped).

**Assumption (region intersection):** If the widest scope is `ORGANIZATION` or `PLATFORM`, region assignments do not hide other regions. Regional Admin therefore must not also receive `ORGANIZATION_ADMIN`.

---

## 3. Permission catalog (MVP)

Naming: `{RESOURCE}_{ACTION}` uppercase.

### 3.1 Platform and administration

| Code | Description |
| --- | --- |
| `ORG_VIEW` | View organization profile |
| `ORG_UPDATE` | Update organization settings |
| `ORG_CREATE` | Create organizations (Super Admin) |
| `REGION_VIEW` | View regions |
| `REGION_MANAGE` | Create/update/deactivate regions |
| `BRANCH_VIEW` | View branches |
| `BRANCH_MANAGE` | Manage branches |
| `DEPARTMENT_VIEW` | View departments |
| `DEPARTMENT_MANAGE` | Manage departments |
| `TEAM_VIEW` | View teams |
| `TEAM_MANAGE` | Manage teams |
| `USER_VIEW` | View users |
| `USER_MANAGE` | Create/update users, reset status |
| `ROLE_VIEW` | View roles |
| `ROLE_MANAGE` | Create/update roles and permission mappings |
| `AUDIT_VIEW` | View audit logs |
| `NOTIFICATION_VIEW` | View own notifications (all authenticated users) |
| `DOCUMENT_VIEW` | View documents on accessible records |
| `DOCUMENT_UPLOAD` | Upload documents on accessible records |
| `DOCUMENT_DELETE` | Delete documents |

### 3.2 CRM

| Code | Description |
| --- | --- |
| `LEAD_VIEW` | View leads in scope |
| `LEAD_CREATE` | Create leads |
| `LEAD_UPDATE` | Update leads |
| `LEAD_DELETE` | Soft-delete leads |
| `LEAD_ASSIGN` | Assign lead owner |
| `LEAD_CONVERT` | Convert lead |
| `LEAD_IMPORT` | Import leads |
| `LEAD_EXPORT` | Export leads |
| `CONTACT_VIEW` | View contacts |
| `CONTACT_CREATE` | Create contacts |
| `CONTACT_UPDATE` | Update contacts |
| `CONTACT_DELETE` | Soft-delete contacts |
| `CONTACT_EXPORT` | Export contacts |
| `ACCOUNT_VIEW` | View accounts |
| `ACCOUNT_CREATE` | Create accounts |
| `ACCOUNT_UPDATE` | Update accounts |
| `ACCOUNT_DELETE` | Soft-delete accounts |
| `ACCOUNT_EXPORT` | Export accounts |
| `DEAL_VIEW` | View deals |
| `DEAL_CREATE` | Create deals |
| `DEAL_UPDATE` | Update deals |
| `DEAL_DELETE` | Soft-delete deals |
| `DEAL_STAGE` | Change deal stage |
| `DEAL_EXPORT` | Export deals |
| `ACTIVITY_VIEW` | View activities |
| `ACTIVITY_CREATE` | Create activities |
| `ACTIVITY_UPDATE` | Update activities |
| `ACTIVITY_DELETE` | Delete own/allowed activities |
| `ACTIVITY_COMPLETE` | Complete activities |

### 3.3 Projects

| Code | Description |
| --- | --- |
| `PROJECT_VIEW` | View projects |
| `PROJECT_CREATE` | Create projects (including from won deal) |
| `PROJECT_UPDATE` | Update projects |
| `PROJECT_DELETE` | Soft-delete/cancel projects |
| `MILESTONE_VIEW` | View milestones |
| `MILESTONE_MANAGE` | Create/update milestones |
| `TASK_VIEW` | View project tasks |
| `TASK_CREATE` | Create tasks |
| `TASK_UPDATE` | Update tasks |
| `TASK_ASSIGN` | Assign tasks |
| `TASK_DELETE` | Soft-delete tasks |

### 3.4 Resources and allocation

| Code | Description |
| --- | --- |
| `RESOURCE_VIEW` | View resources |
| `RESOURCE_MANAGE` | Create/update resources |
| `SKILL_VIEW` | View skills |
| `SKILL_MANAGE` | Manage skill catalog |
| `ALLOCATION_VIEW` | View allocations |
| `RESOURCE_ALLOCATE` | Create/update allocations |
| `ALLOCATION_OVERRIDE` | Allow over-allocation despite warnings |
| `RATE_VIEW` | View cost/billing rates |
| `RATE_MANAGE` | Edit cost/billing rates |

### 3.5 Timesheets

| Code | Description |
| --- | --- |
| `TIMESHEET_VIEW` | View timesheets in scope |
| `TIMESHEET_CREATE` | Create/edit own draft timesheets |
| `TIMESHEET_SUBMIT` | Submit own timesheets |
| `TIMESHEET_APPROVE` | Approve/reject submitted timesheets |
| `TIMESHEET_EXPORT` | Export timesheets |

`TIMESHEET_SELF_APPROVE` is **not** granted to any default role.

### 3.6 Dashboards and search

| Code | Description |
| --- | --- |
| `DASHBOARD_ORG` | Organization dashboard |
| `DASHBOARD_REGION` | Regional dashboard |
| `DASHBOARD_SALES` | Sales dashboard |
| `DASHBOARD_PROJECT` | Project dashboard |
| `DASHBOARD_EMPLOYEE` | Employee (self) dashboard |
| `REPORT_VIEW` | Placeholder for V2 reports; unused in MVP UI |

### 3.7 V2 permissions (catalog now, not implemented)

| Code | Description |
| --- | --- |
| `INVOICE_VIEW` | View invoices |
| `INVOICE_CREATE` | Create invoices |
| `INVOICE_UPDATE` | Update invoices |
| `INVOICE_DELETE` | Void/soft-delete invoices |
| `PAYMENT_MANAGE` | Record payments |
| `PO_VIEW` | View purchase orders |
| `PO_CREATE` | Create POs |
| `PO_APPROVE` | Approve POs |
| `EXPENSE_VIEW` | View expenses |
| `EXPENSE_CREATE` | Create expenses |
| `EXPENSE_APPROVE` | Approve expenses |
| `CONTRACT_VIEW` | View contracts |
| `CONTRACT_MANAGE` | Manage contracts |
| `WORKFLOW_MANAGE` | Manage workflow definitions |
| `APPROVAL_ADMIN` | Manage approval workflows |
| `PORTAL_ACCESS` | Customer portal login |

---

## 4. Role × permission matrix (MVP)

Legend: **F** = full (CRUD where applicable), **R** = read, **C** = create/update own or assigned, **A** = approve, **—** = none

For compactness, related codes are grouped.

| Capability | SUPER | ORG ADMIN | REG ADMIN | SALES MGR | SALES EXEC | PROJ MGR | RES MGR | FINANCE | EMP | VIEWER |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Organizations | F | R/U own | R own | — | — | — | — | R | — | R |
| Regions / branches / depts / teams | F | F | R (+ manage in region if granted) | R | R | R | R | R | R | R |
| Users | F | F | Manage in region | R team | R limited | R project | R | R | R self | R |
| Roles / permissions | F | F | R | — | — | — | — | — | — | — |
| Audit logs | F | F | R region | — | — | — | — | R | — | — |
| Leads | F | F | F region | Team | Own CUD | R related | R | R | — | R |
| Lead convert / assign | F | F | F region | Team | Own assign limited | — | — | — | — | — |
| Contacts / accounts | F | F | F region | Team | Own CUD | R | R | R | R related | R |
| Deals / pipeline | F | F | F region | Team | Own CUD | R | R | R | — | R |
| Activities | F | F | F region | Team | Own | Project | R | R | Own | R |
| Projects | F | F | F region | R | R related | F assigned | R | R | R assigned | R |
| Tasks / milestones | F | F | F region | R | R | F | R | R | C assigned | R |
| Resources | F | F | F region | R | — | R | F | R (no cost unless RATE_VIEW) | R self | R |
| Skills | F | F | R | R | — | R | F | R | R | R |
| Allocations | F | F | F region | — | — | R/create on own projects | F | R | R self | R |
| Cost rates (`RATE_VIEW`) | Y | Y | Y | N | N | N | Y | Y | N | N |
| Timesheet own | Y | Y | Y | Y | Y | Y | Y | Y | Y | N |
| Timesheet approve | Y | Y | Y region | N | N | Y | N | N | N | N |
| Org dashboard | Y | Y | N | N | N | N | N | Y | N | Y* |
| Region dashboard | Y | Y | Y | N | N | N | Y | Y | N | Y* |
| Sales dashboard | Y | Y | Y | Y | Own | N | N | Y | N | Y* |
| Project dashboard | Y | Y | Y | N | N | Y | Y | Y | N | Y* |
| Employee dashboard | Y | Y | Y | Y | Y | Y | Y | Y | Y | N |
| Import leads | Y | Y | Y | Y | N | N | N | N | N | N |
| Export CRM | Y | Y | Y | Y | Own | N | N | Y | N | N |

Y* Viewer dashboards are read-only aggregations still filtered by data scope.

Exact seed mappings will live in Flyway seed SQL. The table above is the product contract.

---

## 5. Record access examples

### 5.1 Sales Executive

- Allowed: leads/deals where `owner_id = currentUser`
- Allowed: activities assigned to them or on their records
- Denied: another executive's pipeline
- Denied: `RATE_VIEW`, invoices (V2), other regions' records even if guessed by UUID

### 5.2 Sales Manager

- Allowed: records owned by users in their team(s), plus own
- Denied: other teams in the same region unless scope is widened

### 5.3 Regional Admin (Pune)

- Allowed: Pune leads, contacts, accounts, deals, projects, resources, timesheets
- Denied: Mumbai, Delhi, Bangalore — including direct GET by id
- Denied: other organizations

### 5.4 Organization Admin

- Allowed: entire organization
- Denied: other organizations

### 5.5 Super Admin

- Allowed: all organizations (platform APIs)
- Must still audit privileged access
- Should use “impersonate org context” carefully; MVP can select an org explicitly on platform screens rather than silent cross-tenant browsing in tenant APIs

### 5.6 Employee / timesheets

- Create/submit only their resource's timesheets
- Cannot approve their own sheet
- Project Manager can approve sheets that include entries on projects they manage (or all regional sheets if they also have regional scope)

**Assumption:** If a timesheet has entries on multiple PMs' projects, any entitled PM may approve the **whole week**, or we require all PMs — MVP uses **any entitled PM or Regional/Org Admin**. Documented to avoid a split-approval engine before V2.

---

## 6. Sensitive fields

| Field | Who can see |
| --- | --- |
| `resources.cost_rate` | `RATE_VIEW` |
| `resource_allocations.cost_rate` | `RATE_VIEW` |
| Margins / profitability internals | `RATE_VIEW` or future `MARGIN_VIEW` |
| Other users' emails/phones | `USER_VIEW` within scope |
| Customer portal (V2) | Never cost rates, never internal notes |

API responses must omit or mask cost rates when the caller lacks `RATE_VIEW`. Frontend hiding is insufficient.

---

## 7. Enforcement checklist (every endpoint)

1. Authenticated?
2. Has permission code?
3. Record in caller's organization (or platform)?
4. Record in caller's region/team/own scope?
5. Field-level restrictions applied on the DTO?
6. Audit logged for mutations?
