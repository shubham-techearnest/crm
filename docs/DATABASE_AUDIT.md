# Database Audit

Inspected Flyway `V1`–`V15` against `DATABASE_DESIGN.md` and JPA entities.

## Strengths

- Org/region FKs on CRM, project, resource, timesheet tables
- Soft-delete columns on major entities
- Partial unique indexes on users email, skills name, timesheet week, resources employee code
- Check constraints on timesheet status and hours
- Indexes for common org+status / org+region list patterns
- Audit, notifications, documents, domain_events tables present

## Issues

| Issue | Priority | Evidence | Recommendation |
| --- | --- | --- | --- |
| Soft-delete unique for regions/projects | Fixed P1 | V15 replaces hard UNIQUE with partial index | Applied |
| Organizations slug hard UNIQUE | P2 | Soft-deleted slug blocks reuse | Partial unique if soft-delete org supported |
| Contacts email not unique per org | P2 | Design allows duplicates | Optional unique if product requires |
| Lead email not unique | P3 | Index only | Accept for MVP |
| Documents lack deleted_at | P2 | V12 | Add when implementing API |
| Audit logs lack region_id | P1 | Regional AUDIT_VIEW org-wide | Add column + filter |
| Allocation deleted_at unused | P2 | No end/cancel API | Wire soft-delete |
| domain_events unused by app | P3 | Table only | V2 listeners |
| ON DELETE CASCADE on junctions | OK | role_permissions, user_roles, refresh_tokens | Expected |
| Soft-delete orphans children | P2 | Project soft-delete leaves tasks | Cascading soft-delete or block delete |

## Orphan / integrity risks

- Soft-deleted project: milestones/tasks remain; APIs hide via active project checks
- Soft-deleted resource: timesheets remain (expected history)
- No DB trigger preventing approved timesheet entry edits (enforced in service)

## Verdict

Schema is **adequate for MVP** after V15. Remaining P1 is audit region scoping; documents remain stub tables.
