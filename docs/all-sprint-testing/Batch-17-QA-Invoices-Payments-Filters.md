# Batch 17 QA — Invoices, billable time pull, lifecycle, payments, filters

**Stories:** US-S16-002, US-S16-003, US-S17-001, US-S17-002, US-S17-003  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Invoices → Create draft (account + region, optional project) | DRAFT invoice; list shell shows row | |
| 2 | Draft → Pull approved billable time | Lines created; amounts from hours × rate | |
| 3 | Same time entry on second invoice | Conflict / NOT_UNBILLED; unique guard | |
| 4 | Issue draft with lines | Number `INV-00001`; status ISSUED; money fields locked for edit | |
| 5 | Void ISSUED (not PAID) | Status VOID; audited | |
| 6 | Past due + unpaid ISSUED | Shows OVERDUE on load/list | |
| 7 | Record partial payment | PARTIALLY_PAID; balance reduced | |
| 8 | Record remaining payment | PAID; balance 0 | |
| 9 | Filters: status, account, due range, min balance, overdue only | List/`/query` returns matching rows | |
| 10 | User without INVOICE_VIEW | Nav hidden; API 403 | |

## Components

- `V26__invoices_payments.sql`
- `Invoice` / `InvoiceLine` / `InvoicePayment` / sequences
- `InvoiceService` + `InvoiceController` (`/api/v1/invoices`)
- `InvoicesPage` + `invoiceFilterCatalog` + `InvoiceFilterFields`
