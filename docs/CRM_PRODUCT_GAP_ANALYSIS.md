# CRM Product Gap Analysis

**Date:** 2026-09-21  
**Method:** Repository inspection + official Zoho CRM Help comparison (see [ZOHO_PARITY_MATRIX.md](./ZOHO_PARITY_MATRIX.md) sources).  
**Scope:** Zoho-like CRM depth within our CRM+PSA+Finance… product boundary — not Zoho One clone.

---

## 1. Current product strengths

- Real multi-tenant modular monolith with org + region isolation enforced server-side  
- Full Lead → Account/Contact/Deal conversion path with duplicate account/contact reuse  
- Deal pipeline + stage history + probabilities  
- Differentiated org graph: Region → Branch → Department → Team → User  
- TEAM visibility (team members + direct reports) after Phase 11  
- Strong PSA: Projects, milestones, tasks/subtasks, allocations, utilization warnings  
- Timesheets with self-approve block, notifications, actual hours rollup  
- Permission-code RBAC (not role-name hardcoding)  
- Global search (5 entities) + five scoped dashboards  
- Soft delete + audit action log + Flyway discipline  

## 2. Current product weaknesses

- CRM **list UX** lacks filters, saved views, column chooser, bulk actions  
- **Documents** table without API/UI (attachments incomplete)  
- No **Notes** / unified **timeline**  
- No configurable **custom fields** / layout rules  
- No **field-level** permissions (cost/margin risk as Finance grows)  
- Notifications almost only timesheets  
- Import/export incomplete vs Zoho mass tools  
- Audit stores action metadata only (no old/new field diffs, no region_id consistently)  
- Forms omit several DB fields (addresses, tax number, etc.)  

## 3. CRM parity gaps (vs relevant Zoho)

See matrices: views/filters (~19–25%), functions (~48%), fields (core OK, platform depth weak), automation (~10% present).

## 4–11. Gap themes

| Theme | Gap |
| --- | --- |
| UX | No RecordShell standard; weak related lists; no quick create |
| Fields | Address UI; tags; nextStep; notes entity; custom fields |
| Validation | Conditional required; duplicate WARN on create; FLS |
| Views | Kanban beyond deals; calendar; timeline |
| Filters | No AND/OR engine; no saved views |
| Search | No module search UI; limited entity set |
| Permissions | Field ACL; assign/export perms incomplete |
| Automation | No workflow/approval engines (timesheet only) |
| Reporting | KPI cards only; no builder / AR / profitability |
| Architecture | Need filter+view+document+metadata foundations before Zoho-like claims |

## 12–16. Architecture / DB / security / performance

| Area | Finding |
| --- | --- |
| Architecture | Modular monolith **can** host V2; extract services only if proven need |
| Database | Solid FKs for sales→project→time; V2 tables designed; documents unused |
| Security | Org/region strong; portal boundary not built; FLS missing |
| Performance | Risk: advanced filters + reports + related lists N+1 — design indexes/async early |

## 17. V2 dependencies

1. Documents API  
2. Filter + SavedView platform  
3. Record detail / related-list shell  
4. Notes + timeline (CRM depth)  
5. Field-level security (at least rates)  
6. Then Finance → … → Portal (see migration plan)  

## 18. Recommended improvements (ordered)

**P0:** Documents; list filter/sort UI; saved views v1; lookup scoping audit  
**P1:** Notes/timeline; bulk assign; conditional validation; FLS for rates; export expansion; RecordShell  
**P2:** Kanban leads/tasks; calendar; custom fields hybrid; clone  
**V2:** Engines, finance, portal, profitability reports  

## 19. Deliberately excluded Zoho features

- Campaigns / marketing automation / Cadences  
- CPQ / Price Books / Quotes as primary billing (we use Invoices)  
- Canvas visual designer / Client Script  
- Zia AI scoring / Workqueue clone  
- Full email client / telephony  
- Blueprint as separate product (use Approval+Workflow instead)  
- Partner portal / Zoho One suite apps  

## 20. Product differentiators

1. **Unified lifecycle** Lead→…→Timesheet→Invoice→Profit in one product  
2. **Regional enterprise control** deeper than flat territories  
3. **Resource + project profitability** (cost vs bill vs expense)  
4. **Single approval/workflow engines** across PSA + Finance  
5. **Customer portal** with hard audience separation  
6. **Allow-listed automations** (typed actions, not script host) in V2  

---

## Gate recommendation

**READY WITH CONDITIONS** — see [V2_PRODUCT_ARCHITECTURE_REVIEW.md](./V2_PRODUCT_ARCHITECTURE_REVIEW.md).
