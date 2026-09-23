# Batch 13 QA — Module layouts, filterable fields, Studio audit, Lead bulk & duplicates

Stories: **US-S11-003**, **US-S11-004**, **US-S11-005**, **US-S12-001**, **US-S12-002**

## US-S11-003 — Default form/list layouts (CRM + delivery)

1. Flyway **V22** applied; Studio shows published CREATE + list layouts for Contact, Account, Deal, Activity, Project, Resource, Timesheet (Lead already from V19).
2. Contacts / Accounts / Deals **Create** uses `DynamicForm` from published form-bundle; Save / Save & New still work.
3. Studio Form/List designers remain editable and publishable for these tables.

## US-S11-004 — Filterable flag

1. Studio Fields: toggle **Filterable** on a field; custom field create has Filterable checkbox.
2. `GET /api/v1/metadata/runtime/tables/{code}/filter-fields` returns only `filterable=true` active fields.
3. Seeded Lead/Contact/Account/Deal/Activity filterable flags present after V22.

## US-S11-005 — Audit Studio publish + ACL

1. Publish form/list/policy/related → audit `PUBLISH` on `SYS_*` with JSON summary in `newValue`.
2. Table ACL / Field ACL upsert → `UPSERT` with role/table/field summary (no secrets).
3. Admin Audit Logs: filter by `PUBLISH` / `UPSERT` and entity `SYS_FORM_LAYOUT` etc.; Summary column shows payload.

## US-S12-001 — Lead bulk assign / status

1. Leads list: select rows via checkboxes; Bulk assign (owner) and Bulk status appear when permitted.
2. Cap 100; partial failures returned in API result; each success audited with `{"bulk":true,...}`.
3. Respects `LEAD_ASSIGN` / `LEAD_UPDATE` + Table ACL Update.

## US-S12-002 — Duplicate warning

1. Create Lead with existing email or company → warning modal with matches; **Create anyway** proceeds; Cancel dismisses.
2. `POST /leads/duplicate-check` is soft-warn only (does not block create API).

## Regression

- Lead DynamicForm create still works.
- Existing single-lead assign/convert unchanged.
