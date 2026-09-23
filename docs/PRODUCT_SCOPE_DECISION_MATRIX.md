# Product Scope Decision Matrix

Every major capability: Zoho relevance × our decision × phase.

Allowed decisions: KEEP · IMPROVE · ADD · V2 · FUTURE · EXCLUDE · DIFFERENTIATE

| Capability | Zoho | Current Product | Decision | Phase | Reason |
| --- | --- | --- | --- | --- | --- |
| Leads/Contacts/Accounts/Deals CRUD | Core | Present | KEEP | MVP | Foundation solid |
| Lead convert | Core | Present | IMPROVE | Pre-V2 | Better mapping UX |
| Deal pipeline | Core | Present | KEEP | MVP | Differentiator-ready |
| Activities | Core | Present | IMPROVE | Pre-V2 | Timeline + types |
| List views + criteria | Core | Weak | ADD | **Foundation** | Parity blocker |
| Advanced filters AND/OR | Core | Missing | ADD | **Foundation** | Parity blocker |
| Saved / shared views | Core | Missing | ADD | **Foundation** | Parity blocker |
| Kanban | Common | Deals only | ADD | Pre-V2 / P2 | Leads/Tasks later |
| Tags | Common | Missing | ADD | Pre-V2 | Filterability |
| Notes | Core | Missing | ADD | Pre-V2 | Sales history |
| Attachments | Core | Table only | ADD | **Foundation P0** | Blocks expenses/portal |
| Custom fields | Core | Missing | ADD | Foundation/P1 | Hybrid metadata |
| Page layouts / Canvas | Core/Canvas | Fixed forms | IMPROVE / EXCLUDE Canvas | P2 / — | Sections yes; designer no |
| Layout / conditional rules | Common | Missing | ADD | Pre-V2 | Validation engine |
| Field-level security | Profiles | Missing | ADD | Pre-V2 | Cost/margin |
| Mass update / assign | Core | Missing | ADD | Pre-V2 | Manager ops |
| Import/export suite | Core | Partial | IMPROVE | Pre-V2 | CSV mapping |
| Workflow rules | Automation | Stub | V2 | V2 | Outbox engine |
| Approval process | Automation | Timesheet | V2 | V2 | Unified engine |
| Blueprint | Process | Missing | EXCLUDE/FUTURE | — | Covered by engines |
| Cadences / Campaigns | Marketing | Missing | EXCLUDE | — | Out of scope |
| Products/Quotes/CPQ | Sales | Missing | EXCLUDE | — | Invoice-centric |
| Forecast module | Sales | Dashboards | FUTURE | Post-V2 | |
| Email/Telephony | Engage | Missing | FUTURE | — | |
| AI scoring | Zia | Missing | EXCLUDE | — | |
| Projects/Tasks | Not CRM core | Strong | DIFFERENTIATE | MVP | Our edge |
| Resources/Allocations | Not CRM core | Strong | DIFFERENTIATE | MVP | Our edge |
| Timesheets | Not CRM core | Strong | DIFFERENTIATE | MVP | Our edge |
| Org Region Branch Dept Team | Territories weaker | Strong | DIFFERENTIATE | MVP | Enterprise control |
| Invoices/Payments/Credits | Often Books | Missing | V2 | V2 Finance | In-monolith |
| Vendors/PO | Separate | Missing | V2 | V2 | |
| Expenses | Expense | Missing | V2 | V2 | |
| Contracts | Often Contracts | Missing | V2 | V2 | |
| Profitability | Analytics | Missing | V2 | V2 Reports | Differentiator |
| Customer portal | Portal | Missing | V2 | Last | Strict boundary |
| Report builder | Analytics | Cards only | V2 | V2 | |
| Multi-currency FX | Editions | Single org currency | FUTURE | — | V2 single currency |
| Microservices | — | Monolith | EXCLUDE | — | No justification |

---

## Phase labels used

| Phase | Meaning |
| --- | --- |
| MVP | Already shipped |
| Foundation | Must precede / gate heavy V2 |
| Pre-V2 | CRM depth sprint(s) overlapping early V2 ok |
| V2 | Version 2 modules |
| Post-V2 / FUTURE | Later |
| — | Never / N/A |
