# MVP Business UAT Report — TechEarnest CRM

**Phase:** 11 — Business Workflow Validation  
**Date:** 2026-09-21  
**Scope:** Realistic organization workflows against the existing MVP (no V2 features)  
**Evidence:** `BusinessWorkflowUatIntegrationTest` (scenarios 1–10) + UI review of Leads/CRM flows  
**Seed password:** `ChangeMe!123`

---

## Executive summary

All ten business scenarios were executed against the live API. Isolation (region + organization) and the core sales→project→timesheet path work. Four **HIGH** (one effectively **BLOCKER** for timesheet→project hours) issues were found and fixed in this phase. Remaining gaps are **MEDIUM/LOW** UX polish and known MVP limitations (documents stub, in-memory rate limit, audit `region_id` completeness).

| Severity | Found | Fixed this phase | Remaining |
| --- | ---: | ---: | ---: |
| BLOCKER | 1 | 1 | 0 |
| HIGH | 3 | 3 | 0 |
| MEDIUM | 6 | 0 | 6 |
| LOW | 4 | 0 | 4 |

---

## Scenario results

### Scenario 1 — New sales lead

| Step | Result |
| --- | --- |
| Create lead | Pass |
| Assign owner | Pass (API + UI now) |
| Schedule follow-up activity | Pass (`OPEN` status) |
| Contact → qualify status | Pass |
| Activity history on lead | Pass |

**UX notes:** Next actions (status → assign → convert) are now visible on the lead detail panel. Activities remain on a separate page (MEDIUM: no inline timeline on the lead).

---

### Scenario 2 — Lead conversion

| Check | Result |
| --- | --- |
| Account + Contact + Deal created | Pass |
| No duplicate account (same company/email) | Pass (reuse on convert) |
| No duplicate contact (same account email) | Pass |
| Deal linked to account/contact/owner/region | Pass |
| Audit CONVERT/CREATE events | Pass (service-level) |

**UX notes:** Convert form can link an existing account when “Create account” is unchecked. Duplicate reuse is automatic when creating.

---

### Scenario 3 — Sales pipeline

| Step | Result |
| --- | --- |
| NEW → QUALIFICATION → REQUIREMENT → PROPOSAL → NEGOTIATION → WON | Pass |
| Dashboard cards update | Pass |
| LOST with reason | Pass |

**UX notes:** Stage changes are clear on Deals. Pipeline forecast/won cards depend on stage correctly.

---

### Scenario 4 — Deal → Project

| Check | Result |
| --- | --- |
| Only WON deals convert | Pass |
| Project keeps dealId + accountId | Pass |
| Contact remains on deal | Pass |
| One project per deal | Pass (conflict on second create) |

---

### Scenario 5 — Project execution

| Step | Result |
| --- | --- |
| Milestones | Pass |
| Tasks + subtasks | Pass |
| Progress % calculation | Pass |
| PM assigned as project manager | Pass (TEAM visibility) |

**UX notes:** Progress is average of task completion % (including subtasks). Milestone “IN_PROGRESS” is invalid (must be PLANNED/ACTIVE/COMPLETED) — API error is technical (MEDIUM).

---

### Scenario 6 — Resource allocation

| Level | Result |
| --- | --- |
| Under / normal / near-full | Pass |
| Over-allocation dry-run warning | Pass (`OVER_ALLOCATED`) |
| Over-allocation with override | Pass (warning retained) |
| Utilization % | Pass |

**UX notes:** Warning is returned in API message/`warning` field; UI should surface it more prominently (MEDIUM).

---

### Scenario 7 — Timesheet

| Step | Result |
| --- | --- |
| Employee create → entries → submit | Pass |
| PM approve (not self) | Pass |
| Notifications | Pass |
| **Project actualHours updated** | Pass (fixed) |
| Audit APPROVE | Pass |

---

### Scenario 8 — Regional admin

| Check | Result |
| --- | --- |
| Cannot GET Mumbai lead by ID | Pass (404) |
| List excludes other region | Pass |
| Dashboard other region | Pass (rejected) |
| Search / export scoped | Pass |

---

### Scenario 9 — Organization isolation

| Check | Result |
| --- | --- |
| Org A cannot read Org B profile | Pass |
| `organizationId` of B on Org A list | Pass (404) |
| Cross-org record access | Pass (existing CrossTenant tests) |

---

### Scenario 10 — Role matrix (smoke)

| Role | Can do (verified) | Cannot do (verified / by design) |
| --- | --- | --- |
| Super Admin | List orgs | N/A (platform) |
| Organization Admin | Users, full CRM | Cross-org |
| Regional Admin | Pune data | Mumbai records |
| Sales Manager | Team leads (fixed TEAM scope) | Outside team owners |
| Sales Executive | Own leads/deals/convert | Org admin functions |
| Project Manager | Projects they manage, approve time | Org-wide lead create |
| Resource Manager | Allocations, utilization | Sales convert |
| Employee | Own timesheets | Approve own / create leads |
| Viewer | Read leads | Create leads (403) |

Full permission catalog remains in `docs/ROLE_PERMISSION_MATRIX.md`.

---

## Findings

### BLOCKER (fixed)

| ID | Finding | Fix |
| --- | --- | --- |
| B-1 | Approved timesheet hours never updated `projects.actual_hours` / task actual hours — Scenario 7 business invariant broken | On approve, roll entry hours into project and task `actualHours` (`TimesheetService.applyApprovedHoursToProjects`) |

### HIGH (fixed)

| ID | Finding | Fix |
| --- | --- | --- |
| H-1 | Lead convert always created new Account/Contact → duplicates | Reuse account by org+name or email; reuse contact by account+email |
| H-2 | Leads UI missing assign owner, status progression, and link-existing-account on convert | `LeadsPage` assign + status + account picker |
| H-3 | TEAM scope collapsed to OWN — Sales Manager could not see executive’s leads | `TeamVisibilityService` (team + direct reports); list filters use `ownerIdsFilterOrNull`; `AccessGuard` TEAM checks visible owners |

### MEDIUM (deferred)

| ID | Finding |
| --- | --- |
| M-1 | Lead detail has no inline activity timeline (user must open Activities) |
| M-2 | Milestone/task status validation errors are code-oriented, not business language |
| M-3 | Over-allocation warning easy to miss in UI tables |
| M-4 | Convert success does not deep-link to Account/Deal/Project |
| M-5 | Documents module still stub (Phase 10) |
| M-6 | Audit log `region_id` not always populated (Phase 10 residual) |

### LOW (deferred)

| ID | Finding |
| --- | --- |
| L-1 | Generic API error strings on some forms (“Could not convert…”) |
| L-2 | Deal stage select on convert omits full pipeline list |
| L-3 | No guided “next best action” wizard across modules |
| L-4 | In-memory rate limiting not multi-instance safe (ops) |

---

## Business UX review (7 questions)

| Question | Verdict |
| --- | --- |
| 1. Is the next action obvious? | **Improved** on Leads (status path + Assign + Convert). Deals/Projects still require knowing module URLs. |
| 2. Is important information visible? | Owner, status, value visible on lead detail. Pipeline stage visible on deals. Project progress visible. |
| 3. Is unnecessary information hidden? | Mostly yes; convert form is compact. |
| 4. Are errors understandable? | Mixed — validation messages OK; some 409/constraint failures still technical (MEDIUM). |
| 5. Can a non-developer complete the workflow? | **Yes** for happy path after H-2, if trained on module order (Lead → Deal → Project → Timesheet). |
| 6. Is the workflow unnecessarily complicated? | Acceptable for MVP; no forced duplicate account creation after H-1. |
| 7. Duplicate data-entry steps? | **Fixed** for account/contact on re-convert; remaining: re-entering deal names manually (LOW). |

---

## Automated evidence

```text
mvn -Dtest=BusinessWorkflowUatIntegrationTest,AccessGuardTest,GoldenPathIntegrationTest test
→ Tests run: 14, Failures: 0, Errors: 0
```

Key test class: `backend/src/test/java/com/techearnest/crm/BusinessWorkflowUatIntegrationTest.java`

---

## Code changes in this phase (BLOCKER/HIGH only)

- `TeamVisibilityService` + `TenantAccess.ownerIdsFilterOrNull` + CRM/search/dashboard list filters
- `AccessGuard` TEAM visibility via team members / direct reports
- `LeadService.convert` account/contact reuse
- `TimesheetService.approve` → project/task actual hours rollup
- `LeadsPage` assign, status, existing-account convert UX

---

## Explicitly out of scope

- V2 features (invoicing depth, advanced reporting, documents storage, team graph UI)
- MEDIUM/LOW polish items above

---

## Recommendation

MVP is **business-usable** for a single-tenant org with regional isolation, sales pipeline, project delivery, and timesheets, provided operators use seeded roles and the happy-path module order. Proceed to production hardening / limited pilot; keep V2 backlog separate.
