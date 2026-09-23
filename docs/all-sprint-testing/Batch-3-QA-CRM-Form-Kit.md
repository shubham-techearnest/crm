# Batch 3 QA — CRM form kit (S4-002 … S4-006)

**Stories:** US-S4-002, US-S4-003, US-S4-004, US-S4-005, US-S4-006  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Contacts → Create | Primary: Account, name, email; Additional expands phone/mobile/dept/etc. | |
| 2 | Contacts Save & New | Saves and clears form without closing | |
| 3 | Accounts → Create | Primary name/region/type/email; Additional addresses/tax/description | |
| 4 | Deals → Create | Primary account/name/value/stage; Additional probability/close/competitor | |
| 5 | Activities → Create | Primary type/subject/related; Additional priority/due/description | |
| 6 | Dirty form + navigate away | Unsaved confirm appears | |
| 7 | Leads create | Uses same FormSection / FormActions / UnsavedGuard kit | |

## Shared components

`frontend/src/components/FormKit/` — `FormSection`, `FormMoreDetails`, `FormActions`, `UnsavedGuard`
