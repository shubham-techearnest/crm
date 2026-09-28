# Batch 22 QA — Portal, hardening, UAT, CX

Stories: US-S26-001, US-S26-002, US-S26-003, US-CX-001, US-CX-002

## Portal UI (US-S26-001)

- Routes: `/portal/login`, `/portal`, `/portal/projects`, `/portal/invoices`, `/portal/documents`
- Separate token key `te.portalAccessToken`
- Demo user: `portal@horizon-retail.example.com` / `ChangeMe!123`

## Production hardening (US-S26-002)

- Checklist: `docs/V2_PRODUCTION_HARDENING_CHECKLIST.md`

## UAT golden path (US-S26-003)

- Updated `docs/MVP_GOLDEN_PATH_TEST.md` with portal + finance steps

## CX-001 / CX-002

- Audit: `docs/UI_STATES_AUDIT.md`
- Saved views: Leads page visibility selector (PRIVATE/SHARED/PUBLIC) for `ORG_UPDATE`
- Backend: `SavedViewService` uses `ORG_UPDATE` for shared/public views
