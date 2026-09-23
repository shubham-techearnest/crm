# Zoho Permission Parity

**Zoho:** Profiles (module + field permissions), Roles (hierarchy), sharing ([S8](https://help.zoho.com/portal/en/kb/crm/faqs/roles-and-profiles/articles/faqs-roles-and-profiles)).  
**Ours:** Permission codes + `DataScope` (PLATFORM…OWN) + region assignments + TEAM visibility via team/manager graph.

| Capability | Zoho | Current | Status | Priority | Decision |
| --- | --- | --- | --- | --- | --- |
| Module Create/Read/Update/Delete | Profile | Permission codes | EXISTING | — | KEEP |
| Import / Export perms | Profile | LEAD_IMPORT/EXPORT, TIMESHEET_EXPORT | PARTIAL | P1 | Expand per module |
| Approve | Automation + profile | TIMESHEET_APPROVE; alloc override | PARTIAL | V2 | Unified APPROVE_* |
| Assign | Change owner | LEAD_ASSIGN | PARTIAL | P1 | DEAL/ACCOUNT_ASSIGN |
| Convert | Convert | LEAD_CONVERT | EXISTING | — | KEEP |
| Record: own | Yes | OWN scope | EXISTING | — | KEEP |
| Record: team | Groups/roles | TEAM + TeamVisibilityService | EXISTING | — | KEEP (improved Phase 11) |
| Record: department | Role hierarchy | DEPARTMENT scope partial | PARTIAL | P2 | IMPROVE |
| Record: region | Territories | REGION + user_regions | EXISTING | — | DIFFERENTIATE |
| Record: organization | Yes | ORGANIZATION | EXISTING | — | KEEP |
| Field visible/read/write | Field permissions | **Missing** | MISSING | P1 | ADD |
| Hide cost_rate | Common need | RATE_VIEW masks some | PARTIAL | P0 | Expand FLS |
| Hide margins | — | N/A yet | V2 | V2 | Portal never sees |
| Sharing rules exceptions | Sharing | No ad-hoc share | FUTURE | P3 | FUTURE |
| Portal separate ACL | Client portal | Not built | V2 | V2 | Separate portal_users |
| Admin profiles immutable | Admin/Standard | System roles flag | PARTIAL | P2 | Harden |

### Scorecard

15 in-scope rows: EXISTING 6, PARTIAL 6, MISSING/V2 3 → **(6+3)/15 = 60%**.

Strength: multi-tenant + regional RBAC. Gap: **field-level security** and complete assign/export matrix.
