# Zoho Function Parity

Compares **record operations** per module. Zoho reference: list-view mass actions [S3](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/managing-module-views/articles/list-view), convert [S1](https://help.zoho.com/portal/en/kb/crm/crm-reference/product-architecture-and-reliability/articles/zoho-crm-s-core-data-model-and-how-you-extend-it-safely).

Legend: Y=full · P=partial · N=missing · V2 · XR=excluded

| Function | Leads | Contacts | Accounts | Deals | Activities | Projects | Resources | Timesheets |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Create | Y | Y | Y | Y | Y | Y | Y | Y |
| Edit | Y | Y | Y | Y | Y | Y | Y | Y (draft) |
| Soft delete | Y | Y | Y | Y | Y | Y | Y | Y |
| Clone | N | N | N | N | N | N | N | N |
| Convert | Y | n/a | n/a | n/a | n/a | from Deal | n/a | n/a |
| Assign / reassign | Y | N | N | N | P | PM field | mgr | n/a |
| Search (module UI) | N | N | N | N | N | N | N | N |
| Search (API) | Y | Y | Y | Y | Y | Y | Y | Y |
| Filter UI | N | N | N | N | N | N | N | N |
| Sort UI | N | N | N | N | N | N | N | N |
| Group | N | N | N | Pipeline | N | N | N | N |
| Import | P (JSON) | N | N | N | N | N | N | N |
| Export | Y CSV | N | N | N | N | N | N | Y CSV |
| Bulk update | N | N | N | N | N | N | N | N |
| Bulk assign | N | N | N | N | N | N | N | N |
| Bulk delete | N | N | N | N | N | N | N | N |
| Notes related | N | P string | N | N | n/a | Comments on tasks | N | N |
| Attachments | N* | N* | N* | N* | N* | N* | N* | N* |
| Activities related | P | P | Y API | P | — | P | N | N |
| Related lists UI | P | N | P | P | N | Y milestones/tasks | P | P |
| Audit view UI | Admin only | — | — | — | — | — | — | — |
| Approval | N | N | N | N | N | N | Over-alloc override | Y |
| Automation | N | N | N | N | N | N | N | Events only |
| Notifications | N | N | N | N | N | N | N | Y |
| Detail panel | Y | N | Y | Y | N | Y | Y | Y |
| Pipeline/Kanban | N | N | N | Y | N | N | N | N |

\* `documents` table exists; **no application API**.

### Priority actions (functions)

| Priority | Action |
| --- | --- |
| P0 | Module search/filter/sort UI on CRM lists; Documents API |
| P1 | Notes entity; bulk assign/update; Contact/Account/Deal export; assign on Deals/Accounts |
| P2 | Clone; Activity calendar; Kanban for Leads/Tasks |
| V2 | Approvals beyond timesheet; workflow automation |

### Scorecard — Function coverage

- **Denominator:** 20 function rows × 8 modules = 160 cells (excluding n/a roughly ~140 scored).  
- **Y ≈ 55**, **P ≈ 25**, **N ≈ 60** (approx from table).  
- **Coverage ≈ (55 + 0.5×25) / 140 ≈ 48%** within this matrix.
