# API Audit

## Conventions (observed)

- Base path `/api/v1`
- Envelope `ApiResponse` with `success`, `data`, `message`, optional `pagination` / `errors`
- Controllers thin; permissions in services via `TenantAccess`
- Entities not returned directly; DTO records used
- Soft-delete via service methods
- Validation via Jakarta annotations + `BusinessException` / `ConflictException`

## Endpoint coverage (MVP)

| Area | Quality | Notes |
| --- | --- | --- |
| Auth | Good | Login/refresh/logout/me/platform |
| Admin org structure | Good | Org/region/branch/dept/team/user/role |
| CRM | Good | Convert, stage, pipeline, export |
| Projects | Good | Nested milestones/tasks |
| Resources | Good | Skills, utilization, allocations |
| Timesheets | Good | Entries, submit/approve/reject, export |
| Dashboards | Good | Five GETs |
| Search | Good | Typed ILIKE, 20/type |
| Notifications | Good (Phase 10) | List + mark read |
| Documents | Missing | Table only |
| OpenAPI | Present | springdoc; disable in prod |

## HTTP status usage

| Case | Typical |
| --- | --- |
| Auth missing | 401 |
| Permission denied | 403 |
| Cross-tenant / out of region | 404 (not 403) — intentional |
| Validation / business rule | 422 |
| Conflict | 409 |
| Unexpected | 500 generic message |

## Gaps

| Gap | Priority |
| --- | --- |
| No OpenAPI completeness review automation | P2 |
| Mass assignment | Low risk — request DTOs explicit |
| File upload endpoints | Missing (multipart config only) |
| Pagination not exposed in all UIs | P2 |
| Sorting limited to controller defaults | P3 |

## Verdict

API layer is **consistent and suitable for MVP** once documents are either implemented or explicitly deferred in product docs.
