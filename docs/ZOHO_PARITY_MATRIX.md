# Zoho CRM Parity Matrix

**Product:** TechEarnest CRM (selected scope)  
**Comparison target:** Zoho CRM **core sales modules** relevant to our scope — not entire Zoho One suite  
**Code evidence date:** 2026-09-21 (repository inspection)  
**Rule:** Functional parity within scope ≠ copy every Zoho feature/edition limit  

Classification legend (PART AK):

| Code | Meaning |
| --- | --- |
| EXISTING | Implemented end-to-end (UI+API+DB+auth+rules) |
| PARTIAL | Exists but incomplete |
| MISSING | Not implemented |
| V2 | Required in Version 2 modules |
| FUTURE | After V2 |
| NOT_REQUIRED | Outside product scope |
| DIFFERENTIATOR | Implement our way / better |
| ARCHITECTURE_CHANGE | Needs foundation before V2 |

Priority: P0 / P1 / P2 / P3

---

## Sources (official Zoho)

| # | Topic | URL |
| --- | --- | --- |
| S1 | Core data model | https://help.zoho.com/portal/en/kb/crm/crm-reference/product-architecture-and-reliability/articles/zoho-crm-s-core-data-model-and-how-you-extend-it-safely |
| S2 | Organize data / modules / Kanban | https://www.zoho.com/one/guides/organizedata.html |
| S3 | List views + criteria (≤25) AND/OR | https://help.zoho.com/portal/en/kb/crm/customize-crm-account/managing-module-views/articles/list-view |
| S4 | Advanced filters + saved filters | https://help.zoho.com/portal/en/kb/crm/customize-crm-account/advanced-filters/articles/advanced-filters |
| S5 | Field customization FAQs | https://help.zoho.com/portal/en/kb/crm/faqs/customization/articles/faqs-field-customization |
| S6 | Workflow rules | https://help.zoho.com/portal/en/kb/crm/automate-business-processes/workflows/articles/configuring-workflow-rules |
| S7 | Approval process | https://help.zoho.com/portal/en/kb/crm/process-management/approval-process/articles/add-approval-process |
| S8 | Profiles / field-level security | https://help.zoho.com/portal/en/kb/crm/faqs/roles-and-profiles/articles/faqs-roles-and-profiles |
| S9 | Module views (Canvas/list/tile) | https://help.zoho.com/portal/en/kb/crm/customize-crm-account/managing-module-views/articles/module-views |
| S10 | Customization overview PDF | https://www.zoho.com/sites/default/files/crm/customization-part1.pdf |

Edition note: Zoho features vary by edition/limits (e.g. automation counts). We treat capabilities as **product patterns**, not edition quotas.

---

## Matrix — Core CRM & platform

| Module | Capability | Zoho Capability | Current Implementation | Status | Priority | Decision | Notes / Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Leads | Capture person+company | Standard Leads module | Entity + create UI + API | EXISTING | — | KEEP | S1 |
| Leads | Convert → Account+Contact+Deal | Convert with field mapping | API/UI convert; account/contact reuse | PARTIAL | P1 | IMPROVE | Mapping UI limited; S1 |
| Leads | Assign owner | Change owner | API + UI assign | EXISTING | — | KEEP | |
| Leads | Status lifecycle | Lead Status picklist | NEW/CONTACTED/QUALIFIED… | PARTIAL | P2 | IMPROVE | No Blueprint-style transitions |
| Leads | Tags | Tags on records | None | MISSING | P2 | ADD | S4 uses tags in filters |
| Leads | Notes | Notes related list | No notes entity | MISSING | P1 | ADD | S4 |
| Leads | Attachments | Attachments | `documents` table only, **no API** | PARTIAL | P0 | ADD | ARCHITECTURE_CHANGE |
| Leads | Duplicate check | Duplicate rules | Convert reuse only | PARTIAL | P1 | IMPROVE | |
| Leads | List filters UI | Advanced filters | API search/status; **no UI filters** | PARTIAL | P0 | ADD | S4 |
| Leads | Custom list views | Custom views + share | None | MISSING | P0 | ADD | S3 |
| Leads | Kanban by status | Kanban view | None | MISSING | P2 | ADD | S2 |
| Leads | Mass update/owner | Mass actions | None | MISSING | P1 | ADD | S3 |
| Leads | Scoring / AI | Zia / scoring | None | NOT_REQUIRED | — | EXCLUDE | Out of scope |
| Contacts | CRUD + Account lookup | Standard Contacts | Full CRUD | EXISTING | — | KEEP | |
| Contacts | Multi-deal link | Contact Roles on Deals | contactId on Deal only | PARTIAL | P2 | IMPROVE | S1 |
| Contacts | Address fields | Address | No structured address | PARTIAL | P2 | ADD | |
| Accounts | CRUD + type | Accounts | Full + accountType | EXISTING | — | KEEP | |
| Accounts | Related lists | Contacts/Deals/Activities… | API related; UI partial | PARTIAL | P1 | IMPROVE | |
| Accounts | Billing/shipping address | Address | jsonb in DB; **UI missing** | PARTIAL | P1 | IMPROVE | |
| Deals | Pipeline stages | Deal stages | Stages + history + pipeline API/UI | EXISTING | — | KEEP | DIFFERENTIATOR: probability defaults |
| Deals | Kanban / drag stage | Kanban | Pipeline columns; stage via button | PARTIAL | P2 | IMPROVE | S2 |
| Deals | Products / Quotes | Products, Quotes, CPQ | None | NOT_REQUIRED | — | EXCLUDE | Finance invoices later, not CPQ |
| Deals | Forecasts module | Forecasts | Dashboard cards only | FUTURE | P3 | FUTURE | S1 |
| Deals | Blueprint | Guided stage process | Stage change validation only | FUTURE | P3 | FUTURE | Prefer Approval/Workflow |
| Activities | Tasks/Calls/Meetings | Activity types | type + subject polymorphic | PARTIAL | P1 | IMPROVE | Calendar view missing |
| Activities | Timeline on record | Timeline | Separate Activities page | PARTIAL | P1 | ADD | |
| Activities | Calendar | Activity calendar | None | MISSING | P2 | ADD | |
| Platform | Custom fields | Modules & Fields | Hardcoded entity fields | MISSING | P1 | ADD | ARCHITECTURE_CHANGE; S5 |
| Platform | Page layouts | Layouts | Fixed forms | MISSING | P2 | ADD | Conditional later |
| Platform | Conditional mandatory | Layout rules | Zod + Bean Validation only | MISSING | P1 | ADD | |
| Platform | Profiles FLS | Field permissions | Module perms only | MISSING | P1 | ADD | S8; cost fields |
| Platform | Roles hierarchy | Roles | Roles + DataScope | PARTIAL | — | DIFFERENTIATOR | Region/Branch/Dept/Team richer |
| Platform | Sharing rules | Sharing | DataScope TEAM/OWN | PARTIAL | P2 | IMPROVE | |
| Platform | Workflow rules | Workflow | domain_events stub only | MISSING | V2 | V2 | S6 |
| Platform | Approval process | Approvals | Timesheet only | PARTIAL | V2 | V2 | S7; DIFFERENTIATOR unified engine |
| Platform | Macros | Macros | None | FUTURE | P3 | FUTURE | |
| Platform | Canvas / UI designer | Canvas views | Bootstrap forms | NOT_REQUIRED | — | EXCLUDE | Use our design system |
| Platform | Global search | Global search | 5 entities, scoped | PARTIAL | P2 | IMPROVE | Expand V2 entities |
| Platform | Import wizard | Import | Lead JSON import only | PARTIAL | P1 | IMPROVE | CSV mapping UX |
| Platform | Export | Export | Leads + Timesheets CSV | PARTIAL | P1 | IMPROVE | |
| Platform | Email integration | Email | None | FUTURE | P3 | FUTURE | |
| Platform | Campaigns | Campaigns | None | NOT_REQUIRED | — | EXCLUDE | Marketing out of scope |
| Platform | Territories | Territories | Regions | DIFFERENTIATOR | — | DIFFERENTIATE | Org→Region→Branch hierarchy |
| PSA | Project/Resource/Time | Not Zoho CRM core | Strong MVP | DIFFERENTIATOR | — | DIFFERENTIATE | Our core edge |
| Finance | Invoices | Zoho Invoice/Books often separate | None | V2 | V2 | V2 | In our monolith |
| Portal | Customer portal | Zoho portals / Client portal patterns | None | V2 | V2 | V2 | Separate auth audience |

---

## Scorecard (documented denominators)

Denominator = capabilities listed in this matrix that are **in-scope** (exclude NOT_REQUIRED rows).

| Metric | In-scope rows | EXISTING | PARTIAL | MISSING/V2/FUTURE | Coverage formula |
| --- | ---: | ---: | ---: | ---: | --- |
| Capability presence | 48 | 8 | 18 | 22 | EXISTING+0.5×PARTIAL = **(8+9)/48 ≈ 35%** “complete-equivalent” |
| CRM core modules only (Leads–Activities rows) | 24 | 5 | 14 | 5 | **(5+7)/24 ≈ 50%** |

**Interpretation:** Backend domain for Leads/Accounts/Contacts/Deals is solid; **CRM UX/platform depth** (views, filters, notes, attachments, bulk, metadata) is the main gap vs Zoho-like depth. Do **not** claim “50% Zoho compatible” as a marketing slogan — this is capability presence within our matrix only.

---

## Decision summary

| Decision | Count (approx) |
| --- | --- |
| KEEP / DIFFERENTIATE | Strong org hierarchy, PSA stack, deal pipeline |
| ADD / IMPROVE before or with V2 | Filters, saved views, notes, documents API, list UX, bulk assign |
| V2 | Workflow, unified approval, finance, portal |
| EXCLUDE | CPQ, Campaigns, Canvas designer, Zia AI, full email client |
