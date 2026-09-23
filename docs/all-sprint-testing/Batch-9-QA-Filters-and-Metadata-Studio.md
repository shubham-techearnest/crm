# Batch 9 QA — Skills/Timesheets filters + Metadata Studio foundation

**Stories:** US-S7-012, US-S7-013, US-S8-001, US-S8-002, US-S8-003  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Skills filters | Name contains + category → `GET /skills` server filters | |
| 2 | Timesheets filters | Status, week start, resource, has billable entries → server filters | |
| 3 | Org Admin → Setup → Metadata Studio | Opens `/admin/studio`; navigator / canvas / inspector; empty states when nothing selected | |
| 4 | Super Admin | No tenant Studio in platform nav; Studio APIs reject PLATFORM scope | |
| 5 | Tables | List seeded CRM/Delivery/Admin tables; cannot delete system table | |
| 6 | Fields | Browse seed fields; edit system label/help; add custom field (max 50); deactivate custom | |
| 7 | Permissions | Requires `METADATA_VIEW` / `METADATA_MANAGE` (Org Admin seeded) | |

## Notes

- Custom field storage decision: definitions in `sys_field`; values intended for per-record JSONB `custom_fields` map (documented in Studio UI + V18).
- Re-login after Flyway V18 so new permissions appear on JWT.

## Components

- `V18__metadata_studio_dictionary.sql`
- `backend/.../metadata/**`
- `frontend/.../admin/studio/StudioPage.tsx`
- `skillFilterCatalog.ts` / `timesheetFilterCatalog.ts`
