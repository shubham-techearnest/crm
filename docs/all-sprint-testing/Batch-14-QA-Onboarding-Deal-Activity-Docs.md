# Batch 14 QA — Module onboarding, Deal stage fields, Meeting/Call, Documents

Stories: **US-S11-006**, **US-S12-003**, **US-S12-004**, **US-S12-005**, **US-S12-006**

## US-S11-006 — Module onboarding

1. Doc: `docs/MODULE_ONBOARDING_DoD.md` linked from delivery plan §7.
2. Flyway **V23**: Studio shows **invoice** table + fields + CREATE/list layouts; demo org ACL for ORG_ADMIN/VIEWER.
3. No invoice nav/API required (stub only).

## US-S12-003 — Deal stage conditional fields

1. Stage → **WON** requires close date (client + server form policy `Close date required when WON`).
2. Stage → **LOST** still requires lost reason.
3. `POST /deals/{id}/stage` accepts `expectedCloseDate`; persists on WON.

## US-S12-004 — Meeting richness

1. Activity columns: location, attendees, outcome.
2. Create form shows **Meeting details** when type=MEETING.
3. Filter by outcome works.

## US-S12-005 — Call richness

1. Columns: callDirection, durationSeconds, outcome.
2. Create form shows **Call details** when type=CALL (direction/duration/outcome).
3. Filter by call direction works.

## US-S12-006 — Documents library upload

1. Documents page: Upload requires entity type + UUID + file; list/tile + download.
2. Deal RecordShell Documents tab: upload + download (parity with Lead).

## Regression

- Existing activity create without richness fields still works.
- Deal pipeline/list unchanged aside from stage validation.
