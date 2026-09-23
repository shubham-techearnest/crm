# V2 Security Model

**Status:** Security design for V2 — no implementation in this phase.  
**Baseline:** MVP JWT + permission codes + data scopes (`PLATFORM` … `OWN`) + `TenantAccess` / `AccessGuard`.  
**Related:** [ROLE_PERMISSION_MATRIX.md](./ROLE_PERMISSION_MATRIX.md), [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md), [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)

---

## 1. Principles

1. **Same tenant wall** — every V2 table is organization-scoped; IDOR returns 404  
2. **Permission codes, never role names** in services  
3. **Field-level denial** for cost/margin on portal and users without `RATE_VIEW`  
4. **Separate auth audiences** for internal vs customer portal  
5. **Least privilege defaults** for new FINANCE_USER / portal roles  

---

## 2. Internal vs customer user boundary

```text
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ Internal User (users)       │     │ Customer User (portal_users)│
│ JWT aud=internal            │     │ JWT aud=portal              │
│ org + region/team/own scope │     │ account_id only             │
│ /api/v1/**                  │     │ /api/v1/portal/**           │
│ Full RBAC permissions       │     │ Fixed portal permission set │
└─────────────────────────────┘     └─────────────────────────────┘
              │                                    │
              └──────── shared DB rows ────────────┘
                 filtered by org + account_id
```

| Control | Internal | Portal |
| --- | --- | --- |
| Table | `users` | `portal_users` |
| Password reset | existing admin flows | portal-specific |
| MFA | future | future |
| Token reuse | refresh cookies | refresh cookies (separate cookie name) |
| Impersonation | not in V2 | not allowed |

**Hard rule:** Portal JWT must never authorize `/api/v1/invoices` internal routes even if IDs are guessed — portal controllers only.

---

## 3. New permission codes (catalog)

### Finance

| Code | Intent |
| --- | --- |
| `INVOICE_VIEW` | List/get invoices |
| `INVOICE_CREATE` | Draft + pull billable time |
| `INVOICE_UPDATE` | Edit draft, issue, credit |
| `INVOICE_DELETE` | Void |
| `PAYMENT_MANAGE` | Record payments |
| `TAX_MANAGE` | Tax rate catalog (or fold into ORG_UPDATE) |

### Procurement

| Code | Intent |
| --- | --- |
| `VENDOR_VIEW` / `VENDOR_MANAGE` | Vendors |
| `PO_VIEW` / `PO_CREATE` / `PO_UPDATE` / `PO_APPROVE` | POs |

### Expenses / contracts

| Code | Intent |
| --- | --- |
| `EXPENSE_VIEW` / `EXPENSE_CREATE` / `EXPENSE_APPROVE` | Expenses |
| `CONTRACT_VIEW` / `CONTRACT_MANAGE` | Contracts |

### Engines / reports / portal

| Code | Intent |
| --- | --- |
| `WORKFLOW_MANAGE` | Definitions |
| `APPROVAL_ADMIN` | Workflow templates |
| `REPORT_VIEW` | Analytics |
| `PORTAL_ACCESS` | Marker on portal tokens (not granted to internal users casually) |

Seed: grant finance codes to `ORGANIZATION_ADMIN` + `FINANCE_USER`; PO to admin + resource/finance as product decides; portal codes only to portal_users via portal auth, not internal role matrix.

---

## 4. Data scope application

| Entity | REGION | TEAM | OWN |
| --- | --- | --- | --- |
| Invoice | `region_id` | owner / account owner team | created_by or account owner |
| Payment | via invoice | via invoice | via invoice |
| Vendor | vendor.region_id | — | — |
| PO | po.region_id | requester team | requester |
| Expense | region | manager chain | resource.user_id |
| Contract | region | account owner team | owner_id |

**Assumption:** Invoice `region_id` copied from Account/Project at create and not widened by finance users beyond their region filter.

Regional Admin must not see other regions’ AR — requires `audit_logs.region_id` and consistent invoice region filters (MVP residual becomes V2 prerequisite).

---

## 5. Approval engine security

- Approver resolution must re-check org + region at action time  
- Self-approve: continue to **block** for timesheets; configurable per workflow for expenses/POs (**Assumption:** default block self-approve)  
- Reject/approve actions audited  
- Parallel steps: all required approvers must approve; any reject fails request  

---

## 6. Workflow engine security

- Definitions: `WORKFLOW_MANAGE` only  
- Actions run as **system** within org context — must not escalate to PLATFORM  
- Action allow-list (no arbitrary SQL)  
- Webhook actions (if any) SSRF-controlled  

---

## 7. Profitability / rate security

| Field | Who can see |
| --- | --- |
| Billing rates on invoices | Finance / invoice viewers (customer-facing amounts OK) |
| Resource `cost_rate` | `RATE_VIEW` only |
| Project profit / margin | `REPORT_VIEW` + `RATE_VIEW` |
| Portal | Never cost or margin |

---

## 8. Document visibility

| Visibility | Internal | Portal |
| --- | --- | --- |
| `INTERNAL` | If record accessible | No |
| `CUSTOMER` | If record accessible | If document.account/project in portal account |

Expense receipts default `INTERNAL`.

---

## 9. Threat scenarios (V2-specific)

| Threat | Mitigation |
| --- | --- |
| Portal user reads other customer invoice by UUID | Portal services filter `account_id` from JWT; tests mandatory |
| Finance user invoices foreign org time entry | Tenant check on each entry |
| Double-bill same hours | Unique `invoice_items.time_entry_id` |
| Approve PO by guessing request id | Participant check on approval_requests |
| Workflow creates project in wrong org | Force org from event payload, ignore client org |
| Credit note laundering to negative AR | Balance guards + audit |
| Swagger enabled in prod exposing portal + finance | Keep `SWAGGER_ENABLED=false` in prod |

---

## 10. Security test matrix (required before V2 go-live)

1. Cross-org invoice/payment/PO/expense/contract IDOR  
2. Cross-account portal IDOR  
3. Regional admin cannot list other region invoices  
4. Employee cannot `PAYMENT_MANAGE`  
5. Portal token rejected on internal `/api/v1/invoices`  
6. `RATE_VIEW` absent → profitability cost fields stripped  
7. Self-approve timesheet still blocked after engine migration  
8. Issued invoice PUT money fields rejected  

---

## 11. MVP security debt that V2 depends on

Close or accept explicitly before customer pilot of Finance/Portal:

- Documents API (or no portal files)  
- Audit `region_id` filtering  
- Redis rate limit (login + portal login)  
- Swagger off in staging/prod  

TEAM visibility for Sales Manager was addressed in MVP Phase 11; keep regression tests.
