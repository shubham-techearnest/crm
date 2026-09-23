# Batch 12 QA — Roles UX, Table ACL seed, Nav ACL, Field ACL / rates

**Stories:** US-S10-003, US-S10-004, US-S10-005, US-S11-001, US-S11-002  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Roles → select role | Search permissions; CRUD summary badges; effective scope shown; confirm on Save | |
| 2 | Roles → Open Table ACL / Field ACL links | Navigate to matrices | |
| 3 | Table ACL matrix | Includes project_task, milestone, resource, allocation, skill, department; VIEWER read-only | |
| 4 | Sidebar as Sales Exec | Modules require permission **and** table ACL read; no dead links | |
| 5 | Super Admin platform nav | Unchanged (no tenant ACL) | |
| 6 | Setup → Field ACL | Role × Field HIDDEN/READ/WRITE for Resource rates | |
| 7 | Sales Exec GET /resources | costRate/billingRate omitted | |
| 8 | Org Admin / Finance | Rates visible when Field ACL allows | |

## Automated

- `FieldAclRateFlsTest`
- `TableAclEvaluatorTest`

## Components

- `V21__complete_table_acl_and_field_acl.sql`
- `FieldAclEvaluator` / `FieldAclMatrixPage`
- `RolesPage` redesign; `AppShell` + `nav.tableCode`
