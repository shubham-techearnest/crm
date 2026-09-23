# Zoho / Industry Module Field Matrix

**Purpose:** Field-level gap analysis for CRM + PSA + planned V2 entities.  
**Rule:** Only include fields justified for our product — not every Zoho custom field type.  
**Sources:** Code entities (2026-09-21); Zoho field customization [S5](https://help.zoho.com/portal/en/kb/crm/faqs/customization/articles/faqs-field-customization); core model [S1](https://help.zoho.com/portal/en/kb/crm/crm-reference/product-architecture-and-reliability/articles/zoho-crm-s-core-data-model-and-how-you-extend-it-safely).

Status: CURRENT = in DB+API (UI may still lag) | UI_GAP | MISSING | V2 | EXCLUDE

---

## Leads

| Field | Type | Required | Current | Zoho/Industry | Gap | Priority | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| firstName | text | Y | Yes | Yes | — | — | KEEP |
| lastName | text | Y | Yes | Yes | — | — | KEEP |
| companyName | text | Y (our) | Yes | Often optional until convert | — | — | KEEP (stricter) |
| email | email | N | Yes | Yes | — | — | KEEP |
| phone | phone | N | Yes | Yes | Format validation weak | P2 | IMPROVE |
| website | url | N | Yes | Yes | UI create omits | P2 | IMPROVE |
| source | picklist | N | Free text | Picklist | Normalize picklist | P1 | IMPROVE |
| status | picklist | Y | Yes | Lead Status | — | — | KEEP |
| priority | picklist | N | Yes | Yes | — | — | KEEP |
| industry | text | N | Yes | Picklist | UI create omits | P2 | IMPROVE |
| designation | text | N | Yes | Title | UI omits | P2 | IMPROVE |
| estimatedValue | currency | N | Yes | Yes | — | — | KEEP |
| expectedCloseDate | date | N | Yes | Yes | UI omits | P2 | IMPROVE |
| description | long text | N | Yes | Yes | UI omits | P2 | IMPROVE |
| ownerId | lookup User | Y | Yes | Owner | — | — | KEEP |
| regionId | lookup Region | Y | Yes | Territory-like | DIFFERENTIATOR | — | KEEP |
| street/city/state/country/zip | address | N | No | Address | Missing | P2 | ADD |
| tags | multi | N | No | Tags | Missing | P2 | ADD |
| ranking/score | number | N | No | Scoring | Out of scope | — | EXCLUDE |
| campaign | lookup | N | No | Campaigns | Out of scope | — | EXCLUDE |

---

## Contacts

| Field | Type | Required | Current | Gap | Priority | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| accountId | lookup | Y | Yes | — | — | KEEP |
| firstName/lastName | text | Y | Yes | — | — | KEEP |
| email/phone/mobile | contact | N | Yes | — | — | KEEP |
| designation/department | text | N | Yes | — | — | KEEP |
| linkedinUrl | url | N | Yes | — | — | KEEP |
| notes | long text | N | Single string | Prefer Notes related list | P1 | IMPROVE |
| mailing address | address | N | No | Missing | P2 | ADD |
| reportsTo | lookup Contact | N | No | Nice-to-have | P3 | FUTURE |

---

## Accounts

| Field | Type | Required | Current | Gap | Priority | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| name | text | Y | Yes | — | — | KEEP |
| accountType | picklist | N | Yes | — | — | KEEP |
| status | picklist | N | Yes | — | — | KEEP |
| industry/website/email/phone | mixed | N | Yes | — | — | KEEP |
| taxNumber | text | N | Yes (DB) | GSTIN | UI expose | P1 | IMPROVE |
| billingAddress/shippingAddress | jsonb | N | DB yes | **Create UI missing** | P1 | IMPROVE |
| parentAccount | lookup | N | No | Hierarchy | P3 | FUTURE |
| annualRevenue | currency | N | No | Optional | P3 | FUTURE |
| employees | number | N | No | Optional | P3 | FUTURE |

---

## Deals

| Field | Type | Required | Current | Gap | Priority | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| name | text | Y | Yes | — | — | KEEP |
| accountId | lookup | Y | Yes | — | — | KEEP |
| contactId | lookup | N | Yes | Contact roles M:N later | P2 | IMPROVE |
| stage | picklist | Y | Yes | — | — | KEEP |
| value | currency | N | Yes | — | — | KEEP |
| probability | % | N | Auto by stage | Editable override? | P2 | IMPROVE |
| expectedCloseDate | date | N | Yes | Required when WON (rule) | P1 | ADD rule |
| source/competitor/description | text | N | Yes | UI partial | P2 | IMPROVE |
| lostReason | text | N | Yes on LOST | Require on LOST | P1 | ADD rule |
| product line items | subform | N | No | Use invoice later | — | EXCLUDE (CRM) |
| nextStep | text | N | No | Common Zoho field | P2 | ADD |

---

## Activities

| Field | Type | Required | Current | Gap | Priority | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| type | picklist | Y | Free/typed | Enforce CALL/TASK/MEETING | P1 | IMPROVE |
| subject | text | Y | Yes | — | — | KEEP |
| relatedEntity | polymorphic | Y | Yes | Related picker UX | P1 | IMPROVE |
| assignedTo | lookup | Y | Yes | — | — | KEEP |
| dueDate | datetime | N | Yes | — | — | KEEP |
| status | picklist | Y | OPEN/COMPLETED/CANCELLED | — | — | KEEP |
| priority | picklist | N | Yes | — | — | KEEP |
| description | long text | N | Yes | — | — | KEEP |
| reminder | datetime | N | No | Missing | P2 | ADD |
| location | text | N | No | Meetings | P2 | ADD |

---

## Projects / Tasks / Resources / Timesheets (non-Zoho CRM — our modules)

| Module | Notable fields present | Gaps vs enterprise PSA |
| --- | --- | --- |
| Projects | code, account, deal, PM, budget, hours, billingType | contract_id (V2), health score (FUTURE) |
| Tasks | parent, milestone, % complete, resource, hours | Board/kanban UI (P2) |
| Resources | cost/billing rates, capacity, skills | Leave/unavailability (V2 advanced) |
| Timesheets | week, entries, billable, rates, approve | Invoice link (V2) |

---

## V2 modules (planned fields — design only)

### Invoices (see also V2_DATABASE_DESIGN)

invoice_number, account, project, contract, currency, issue/due dates, status, subtotal, tax_total, total, amount_paid, balance_due, payment_terms_days, place_of_supply, notes, region, owner/issuer.

### Vendors / PO / Expenses / Contracts

Documented in [V2_DATABASE_DESIGN.md](./V2_DATABASE_DESIGN.md). Not listed field-by-field here to avoid duplication; implementation phase expands.

---

## Field architecture recommendation (PART C)

| Approach | Verdict |
| --- | --- |
| Continue hardcoded Java fields only | **Insufficient** for Zoho-like depth and customer-specific attributes |
| Full metadata-driven everything day-1 | Over-engineered for first V2 finance slice |
| **Recommended:** Hybrid | Keep **standard fields** as first-class columns; introduce `custom_field_definitions` + `custom_field_values` (org-scoped) for ADDITIVE attributes; picklists as reference tables |

**Phase:** Architecture spike **before** or in parallel with Finance — Priority **P1 / ARCHITECTURE_CHANGE**. Do not block Finance MVP if custom fields ship one sprint later, but do not paint ourselves into more hardcoded special cases.
