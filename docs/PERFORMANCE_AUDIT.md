# Performance Audit

## Observed risks (not premature optimizations)

| Risk | Priority | Evidence | Suggestion |
| --- | --- | --- | --- |
| Dashboard loads full entity lists then aggregates in memory | P2 | `DashboardService` uses `Pageable.unpaged()` / export lists | SQL `group by` if data grows |
| Frontend lists request up to 100 rows | P2 | Pages pass size 100 | Add paging controls |
| N+1 on timesheet list totals | Low | Batch `findActiveByTimesheetIdIn` used | OK for MVP |
| JWT carries full permission set | P3 | Larger tokens; stale until TTL | Accept or shorten TTL |
| Login rate limiter map growth | P3 | ConcurrentHashMap per IP | Redis later |
| Bundle size | P3 | Vite build warned >500kB | Code-split routes later |
| Search multi-type sequential queries | P2 | Five repo searches | Parallelize if latency matters |
| open-in-view false | Good | `application.yml` | Avoids lazy surprises |

## What looks healthy

- Indexes on org/region/status for main tables
- Soft-delete filters in JPQL
- No entity graphs returning thousands of nested rows on detail APIs reviewed
- Utilization computed in service with bounded allocation queries

## Verdict

**No P0 performance blockers** for demo-scale data. Plan SQL aggregations and UI pagination before large tenants.
