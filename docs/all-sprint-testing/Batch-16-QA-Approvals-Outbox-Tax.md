# Batch 16 QA — Approvals dual-write, Inbox, Outbox/Workflow, Tax rates

**Stories:** US-S14-002, US-S14-003, US-S15-001, US-S15-002, US-S16-001  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Submit timesheet | `approval_requests` row PENDING for TIMESHEET; default MANAGER workflow auto-created | |
| 2 | Approve / reject on Timesheets page | Timesheet status updates; approval request closed; `approval_actions` logged | |
| 3 | My Approvals (`/approvals`) | Pending list; filter by type; Approve/Reject with comment dual-writes timesheet | |
| 4 | Manager without override of unrelated sheets | Only sees timesheets where they are resource manager (MANAGER step) | |
| 5 | Mark Deal WON | Outbox `domain_events` row `DEAL_WON`; poller processes; notification to deal owner; audit `EXECUTE` | |
| 6 | Workflow tables | `workflow_definitions` / `actions` / `runs` populated for DEAL_WON_NOTIFY_PM | |
| 7 | Tax Rates (`/tax-rates`) | Create CGST/SGST/IGST codes; list/filter; TAX_VIEW / TAX_MANAGE gated | |
| 8 | User without TAX_VIEW | 403 on `/api/v1/tax-rates` | |

## Components

- `ApprovalService` + `ApprovalController` (`/api/v1/approval-requests`)
- Timesheet submit/approve/reject dual-write hooks
- `OutboxPublisher` / `OutboxProcessor` + hardened `domain_events`
- `WorkflowEngine` NOTIFY action pack (Deal WON → PM/owner)
- `TaxRate*` CRUD + `TaxRatesPage`
- Flyway `V25__approvals_outbox_workflow_tax.sql`
