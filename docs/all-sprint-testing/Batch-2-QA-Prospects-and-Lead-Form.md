# Batch 2 QA — Prospect Orgs + Lead form

**Stories:** US-S3-001, US-S3-002, US-S3-003, US-S3-004, US-S4-001  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Super Admin → Prospect Orgs | CRUD create/edit/delete works | |
| 2 | Filters: stage, source, search, min ARR | List updates; ARR uses FilterEngine query | |
| 3 | Prospect WON/PROPOSAL → Create org | Org wizard prefills; on save prospect links | |
| 4 | Super Admin sidebar | No Leads; only Platform modules | |
| 5 | Org Admin → Leads → Create | Primary fields only; Additional details expands | |
| 6 | Org Admin `/platform/prospects` | Redirected away | |

## Automated

- `PlatformProspectTest`
