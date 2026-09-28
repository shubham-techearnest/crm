# UI states audit (CX-001)

Audit of Empty / Loading / Error / Forbidden patterns across primary modules.

| Module | Loading | Empty | Error | Forbidden / no permission |
| --- | --- | --- | --- | --- |
| Leads | `LoadingState` | Table empty row | `ErrorState` | `RoutePermission` redirect |
| Activities | `LoadingState` | Table empty row | `ErrorState` | Route + action buttons hidden |
| Timesheets | `LoadingState` | List + detail empty | Detail drawer alert | Submit/approve gated by permission |
| Reports | `LoadingState` | MapList "No data" | `ErrorState` | Nav hidden without `REPORT_VIEW` |
| Expenses | `LoadingState` | Table empty row | `ErrorState` | Nav + route guard |
| Portal | `LoadingState` | Table "No records" | `ErrorState` | Separate login + token guard |
| Platform prospects | `LoadingState` | Table empty copy | `ErrorState` with message | Platform guard only |
| Admin workflows | `LoadingState` | Table empty copy | `ErrorState` | `WORKFLOW_VIEW` route guard |

## Residual gaps

- Some platform placeholder routes still use generic placeholder pages (Settings/Audit) — expected deferred.
- Tile view on several modules lacks dedicated empty illustration (list empty row covers primary path).
- Browser-level forbidden page is redirect-to-home rather than dedicated 403 screen (by design in V1).

## Verdict

Primary CRM, finance, reports, portal, and platform prospect modules meet the CX-001 bar for the four required states on list/report surfaces.
