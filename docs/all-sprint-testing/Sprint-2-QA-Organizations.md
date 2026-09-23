# Sprint 2 QA — Organizations (Platform Console)

**Stories:** US-S2-001 … US-S2-005  
**Date:** 2026-09-22  
**Depends on:** Sprint 1 Platform Console  

## Product rule

Super Admin creates and lifecycle-manages **tenant organizations** here.  
Org Admin then runs CRM inside their tenant — not in Platform Console.

## Manual checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Super Admin → Organizations | List loads with search + status filter; total count | |
| 2 | Create organization wizard (3 steps) | Org + default region + admin user created | |
| 3 | Open org detail | Overview shows settings + user/region counts | |
| 4 | Sign in as new Org Admin | Lands on tenant `/` (not Platform) | |
| 5 | Suspend org from Platform | Status = SUSPENDED | |
| 6 | Org Admin tries login while suspended | Forbidden / clear suspended message | |
| 7 | Reactivate org | Org Admin can login again | |
| 8 | Org Admin opens `/platform/organizations` | Redirected to tenant home | |
| 9 | `POST /api/v1/platform/organizations` as Org Admin | 403 | |

## Automated

- `PlatformOrganizationTest` — provision, suspend blocks login, reactivate, Org Admin forbidden  

## Sign-off

| Role | Name | Date |
| --- | --- | --- |
| Product / QA | | |
