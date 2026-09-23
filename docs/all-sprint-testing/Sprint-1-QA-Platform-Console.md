# Sprint 1 QA — Super Admin ≠ tenant Leads

**Stories:** US-S1-001 … US-S1-004, US-CX-003  
**Date:** 2026-09-22  

## Product rule

Super Admin (`dataScope=PLATFORM`) operates the **Platform Console** (`/platform/*`).  
They do **not** run tenant CRM modules (Leads, Deals, etc.) as daily SaaS work.

## Manual checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Sign in as `superadmin@example.com` / `ChangeMe!123` | Lands on `/platform` Platform Dashboard | |
| 2 | Inspect sidebar | Only Platform nav (Dashboard, Organizations, Prospect Orgs, Settings, Audit) — **no Leads** | |
| 3 | Manually open `/leads` | Redirected to `/platform` | |
| 4 | Dashboard cards load | Organizations, Active orgs, Suspended orgs, Active users (aggregate) | |
| 5 | `GET /api/v1/platform/dashboard` with Super Admin token | 200 + KPI JSON | |
| 6 | Sign in as `orgadmin@example.com` | Lands on `/` tenant Home — **no Platform Console nav** | |
| 7 | Org Admin opens `/platform` | Redirected to `/` | |
| 8 | `GET /api/v1/platform/dashboard` with Org Admin token | 403 | |
| 9 | `GET /api/v1/auth/platform` with employee token | 403 | |

## Automated

- `PlatformDashboardTest` — Super Admin OK, Org Admin forbidden  

## Sign-off

| Role | Name | Date |
| --- | --- | --- |
| Product / QA | | |
