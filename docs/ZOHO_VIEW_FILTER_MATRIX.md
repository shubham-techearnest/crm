# Zoho View & Filter Matrix

**Zoho refs:** [List views](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/managing-module-views/articles/list-view) (criteria ≤25, AND/OR pattern editor), [Advanced filters](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/advanced-filters/articles/advanced-filters) (save filter per user, related-module criteria), [Module views](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/managing-module-views/articles/module-views) (list, Canvas list/tile/table), [Kanban](https://www.zoho.com/one/guides/organizedata.html).

---

## Views

| View type | Zoho | Our CRM modules | Our PSA | Priority | Decision |
| --- | --- | --- | --- | --- | --- |
| List / table | Standard | Bootstrap tables | Same | — | KEEP + harden |
| Grid / sheet | Sheet view | No | No | P3 | FUTURE |
| Kanban | Yes | Deals pipeline only | No | P1 Deals polish; P2 Leads/Tasks | ADD |
| Timeline | Activity timeline | No unified | Task dates only | P1 | ADD |
| Calendar | Activities | No | No | P2 | ADD |
| Split (list+detail) | Common pattern | Leads/Deals/Accounts partial | Projects | P1 | IMPROVE standardize |
| Chart | Reports | Dashboards only | Same | V2 | V2 report builder |
| Card / tile | Canvas tile | No | No | P3 | FUTURE |
| Canvas designer | Yes | No | No | — | EXCLUDE |

---

## Filters & saved views

| Capability | Zoho | Current | Status | Priority | Decision |
| --- | --- | --- | --- | --- | --- |
| Single-field search | Yes | API `search` param; **UI absent** on CRM lists | PARTIAL | P0 | ADD UI |
| Equality filters (status/stage) | Yes | API params; UI weak | PARTIAL | P0 | ADD |
| Multiple conditions | Yes | No | MISSING | P0 | ADD |
| AND / OR | Pattern editor | No | MISSING | P0 | ADD |
| Nested groups | Yes | No | MISSING | P1 | ADD |
| Related / lookup filters | Yes | No | MISSING | P1 | ADD |
| Relative dates (Age/Due in days) | Yes | No | MISSING | P1 | ADD |
| Current user / My records | Yes | OWN scope implicit | PARTIAL | P1 | ADD explicit |
| Current region | Territory-like | Region scope | PARTIAL | P1 | ADD filter chip |
| Current team | Groups | TEAM scope | PARTIAL | P1 | ADD |
| Is empty / not empty | Yes | No | MISSING | P1 | ADD |
| In / Between | Yes | No | MISSING | P1 | ADD |
| Saved filters (user) | Yes | No | MISSING | P0 | ADD |
| Shared / public views | Yes | No | MISSING | P1 | ADD |
| Favorites | Yes | No | MISSING | P2 | ADD |
| Column chooser | Yes | Fixed columns | MISSING | P1 | ADD |
| Column sort | Yes | Server default only | PARTIAL | P0 | ADD |
| Grouping | Views | Pipeline only | PARTIAL | P2 | IMPROVE |
| Page size preference | Yes | Hardcoded size=100 | PARTIAL | P2 | IMPROVE |

---

## Architecture recommendation — Filter engine (PART I)

Introduce shared platform:

```text
FilterDefinition { module, logicTree }
Condition { field, operator, value | relativeToken }
SavedView { owner, visibility, filter, columns[], sort[], viewType }
```

- Backend: translate tree → JPA Specification / QueryDSL / Criteria (org+region+owner scope **always AND-ed** server-side).  
- Frontend: reusable FilterBuilder + SavedViewPicker.  
- **P0 before claiming Zoho-like CRM depth.** Can ship without nested groups first (flat AND), then OR/nesting.

---

## Scorecard — View/Filter

| Metric | Denominator | Present (Y+0.5P) | Coverage |
| --- | ---: | ---: | ---: |
| View types in-scope (8) | 8 | List + Split(P) + Kanban(P) ≈ 2.0 | **~25%** |
| Filter capabilities in-scope (18) | 18 | ~3.5 | **~19%** |

Largest CRM UX gap vs Zoho.
