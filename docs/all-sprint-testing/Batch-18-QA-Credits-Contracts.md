# Batch 18 QA — Credit notes, Invoice RecordShell, Contracts

**Stories:** US-S18-001, US-S18-002, US-S19-001, US-S19-002, US-S19-003  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Issued invoice → Credits tab → Apply credit | Balance drops; `amountCredited` increases; status may become PARTIALLY_PAID/PAID | |
| 2 | Credit without CREDIT_NOTE_MANAGE / INVOICE_UPDATE | 403 | |
| 3 | Invoice detail RecordShell | Overview / Payments / Credits tabs; Issue/Void header actions | |
| 4 | Export CSV toolbar | Downloads `invoices.csv` (PDF stub not required) | |
| 5 | Contracts → Create (account, dates, value, auto-renew) | List row; org isolation | |
| 6 | Expiry within N days filter | Relative endDate BETWEEN today and +N | |
| 7 | Active contract ending within notice days | Scheduler creates one reminder/day; notification to owner; no duplicates | |
| 8 | CONTRACT_VIEW missing | Nav hidden; API 403 | |

## Components

- `V27__credit_notes_and_contracts.sql`
- `CreditNoteService` / `CreditNoteController`
- Invoice `amount_credited` + RecordShell + CSV export
- `ContractService` / `ContractController` / `ContractExpiryReminderJob`
- `ContractsPage` + `contractFilterCatalog`
