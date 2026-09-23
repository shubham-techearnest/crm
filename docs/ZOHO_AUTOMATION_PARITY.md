# Zoho Automation Parity

**Zoho:** Workflow Rules (trigger → criteria → actions), Approval Process, Blueprint, Cadences, CommandCenter ([S6](https://help.zoho.com/portal/en/kb/crm/automate-business-processes/workflows/articles/configuring-workflow-rules), [S7](https://help.zoho.com/portal/en/kb/crm/process-management/approval-process/articles/add-approval-process)).  
**Ours:** Spring domain events (in-memory) + `domain_events` table stub (V13) + timesheet notifications; no configurable engine.

| Capability | Zoho | Current | Map to our V2 | Priority | Decision |
| --- | --- | --- | --- | --- | --- |
| Record created trigger | Workflow | Code listeners only | WorkflowEngine | V2 | V2 |
| Field/status changed | Workflow | Deal stage history only | WorkflowEngine | V2 | V2 |
| Date-based / scheduled | Workflow | Overdue tasks partial | Scheduler + Workflow | V2 | V2 |
| Criteria AND/OR | Pattern editor | Hardcoded | Condition tree | V2 | V2 |
| Field update action | Yes | Hardcoded | Action UPDATE_FIELD | V2 | V2 |
| Create task / notify | Yes | Timesheet notify | Action CREATE_TASK / NOTIFY | V2 | V2 |
| Assign owner | Yes | Manual | Action ASSIGN | V2 | V2 |
| Convert lead | Workflow action | Manual API | Optional action | P2 | IMPROVE |
| Webhook | Yes | No | Action WEBHOOK | FUTURE | FUTURE |
| Deluge / custom code | Yes | Java services | Prefer typed actions | — | DIFFERENTIATE (no Deluge) |
| Approval multi-step | Approval process | Timesheet 1-step | ApprovalEngine | V2 | V2 |
| Approver: user/role/manager | Yes | Manager on resource | USER/ROLE/MANAGER/DEPT/REGION | V2 | V2 |
| Parallel / any-one | Yes | No | Step modes | V2 | V2 |
| Delegation / escalate | Yes | No | Phase 2 of engine | FUTURE | FUTURE |
| Approval history | Yes | Audit APPROVE | approval_actions | V2 | V2 |
| Record lock while pending | Yes | Timesheet draft lock | Per-target adapter | V2 | V2 |
| Blueprint guided UI | Yes | No | EXCLUDE initially | — | EXCLUDE / FUTURE |
| Cadences / sequences | Yes | No | Marketing-ish | — | EXCLUDE |
| Execution order complexity | Documented stack | N/A | Keep simpler order | — | DIFFERENTIATE |
| Execution history / retry | Limited | No | workflow_runs + outbox | V2 | V2 |
| Loop prevention | Needed | N/A | Max depth + idempotency keys | V2 | V2 |

### Our differentiator

**One Approval Engine + one Workflow Engine** across Timesheet, Expense, PO, Invoice, Deal, Allocation — Zoho spreads these across CRM automation + separate finance apps. Keep actions **allow-listed** (no arbitrary script host in V2).

### Scorecard

20 in-scope automation capabilities: ~2 partial, ~14 V2, ~4 exclude → **present ≈ 10%**; **planned V2 ≈ 70%** of in-scope automation.
