# Batch 10 QA — Field Dictionary + Form/List Designers + DynamicForm

**Stories:** US-S8-004, US-S8-005, US-S9-001, US-S9-002, US-S9-003  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Studio → Leads / Contacts / Accounts / Deals / Activities | Primary CRM fields listed with types; no manual seed needed | |
| 2 | Employee / Sales Exec → `/api/v1/metadata/tables` | 403 | |
| 3 | Super Admin → Studio APIs | 403 (PLATFORM rejected) | |
| 4 | User with ROLE_MANAGE only | 403 on Studio (METADATA_* required) | |
| 5 | Org Admin → Studio → Form layout | Sections, order, ALWAYS/MORE; Save draft; Discard; Publish; Preview | |
| 6 | Org Admin → Studio → List layout | Columns + default sort; Save/Publish/Discard | |
| 7 | Org User → Leads → Create | Form fields/sections match published Lead CREATE layout (DynamicForm) | |
| 8 | Change form layout in Studio → Publish → reopen Lead create | Form updates without redeploy | |

## Automated

- `MetadataStudioPermissionTest`

## Components

- `V19__crm_field_dictionary_and_layouts.sql`
- `MetadataLayoutService` / `MetadataLayoutController`
- `StudioPage` Form + List tabs
- `DynamicForm` + Lead create pilot (`form-bundle` runtime API)
