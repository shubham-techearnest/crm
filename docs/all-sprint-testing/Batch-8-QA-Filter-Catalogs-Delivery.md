# Batch 8 QA — Advanced filter catalogs (Projects → Allocations)

**Stories:** US-S7-007, US-S7-008, US-S7-009, US-S7-010, US-S7-011  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Projects filter rail | Status, account, manager (Current user), start/end dates, Delayed only → server list | |
| 2 | Tasks filter rail | Project optional, status, priority, assignee, due from/to → `GET /tasks` | |
| 3 | Milestones filter rail | Project optional, status, due from/to → `GET /milestones` | |
| 4 | Resources filter rail | Availability (status), region, skill → server list | |
| 5 | Allocations filter rail | Status, project, resource, Overlapping only → server list | |
| 6 | Whitelist | `*FilterFields.ALLOWED` matches UI catalogs | |

## Components

- `backend/.../{Project,Task,Milestone,Resource,Allocation}FilterFields.java`
- `frontend/.../{project,task,milestone,resource,allocation}FilterCatalog.ts`
- Org-level `GET /api/v1/tasks` and `GET /api/v1/milestones`
