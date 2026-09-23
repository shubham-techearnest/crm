# Frontend Audit

## Structure

- Vite + React + TS; feature folders under `src/features`
- TanStack Query + RHF + Zod
- App shell with permission-filtered nav
- Phase 10: `RoutePermission` on all feature routes

## Strengths

- Loading / empty / error via `CrmPage` / `AdminPage`
- Forms validated with Zod; submit buttons disable on pending
- StatusBadge tones for CRM/project/timesheet statuses
- Global search + notifications menu
- Responsive sidebar collapse

## Gaps

| Gap | Priority | Notes |
| --- | --- | --- |
| Shared DataTable / FilterPanel | P2 | ag-grid installed unused |
| List pages fetch size 100, no search box | P2 | Backend supports search |
| Search hits open list routes only | P2 | No detail deep-link |
| Branches / teams UI absent | P2 | APIs exist |
| Lead import UI | P2 | — |
| Lead assign UX thin | P2 | API exists |
| Dashboard cache after CRM mutations | Improved | Lead convert + deal stage invalidate dashboards |
| ErrorState retry unused | P3 | — |
| Vitest coverage low | P1 | 3 smoke tests only |
| a11y: search combobox / aria-expanded | P3 | — |

## UX consistency

- Tables are Bootstrap native across modules — consistent but not AG Grid
- Disabled V2 nav items hidden rather than shown disabled
- Breadcrumbs are static labels, not links

## Verdict

Frontend is **usable for MVP demo and internal UAT** after route guards and notifications. Not yet polished enterprise UX (DataTable, filters, deep links).
