# Batch 19 QA — Expenses, Vendors, Purchase Orders

**Stories:** US-S20-001, US-S20-002, US-S20-003, US-S21-001, US-S21-002  
**Date:** 2026-09-22  

## Checklist

| # | Step | Expected | Pass? |
| --- | --- | --- | --- |
| 1 | Expenses → Create (region, type, date, ≥1 line with category/amount, billable) | Draft row; org isolation; total from lines | |
| 2 | Expense detail → Submit (EXPENSE_CREATE) | Status → SUBMITTED | |
| 3 | Approver with EXPENSE_APPROVE → Approve / Reject | Status → APPROVED or REJECTED | |
| 4 | Expense filters: status, type, category, project, employee, billable, date range | List narrows; advanced filters use `/expenses/query` | |
| 5 | EXPENSE_VIEW missing | Nav hidden; route/API 403 | |
| 6 | Vendors → Create (name, region, optional email/tax/terms) | List row; Edit with VENDOR_MANAGE | |
| 7 | Vendor status / region / search filters | List narrows; org isolation | |
| 8 | VENDOR_VIEW missing | Nav hidden; API 403 | |
| 9 | Purchase Orders → Create draft with vendor + line items | Draft PO; subtotal/tax/total; ModuleListShell UX | |
| 10 | PO detail → Add line while DRAFT (PO_CREATE) | New line; totals refresh | |
| 11 | PO filters: status, vendor, project | List narrows | |
| 12 | PO_VIEW missing | Nav hidden; API 403 | |

## Notes

- Receipt document upload (`POST /expenses/{id}/receipts`) is deferred; lines may carry optional `documentId` when Documents wiring lands.
- PO approval lifecycle (submit/approve) is US-S22-001; FE API stubs exist but UI actions are draft-focused in this batch.
- `VENDOR_VIEW` / `VENDOR_MANAGE` expected in backend seed (V2 catalog); `EXPENSE_*` and `PO_*` already in `V14__seed_permissions_and_demo.sql`.

## Components

- `src/features/expenses/` — `expenseApi`, `ExpensesPage`, `expenseFilterCatalog`
- `src/features/procurement/` — `vendorsApi`, `VendorsPage`, `purchaseOrdersApi`, `PurchaseOrdersPage`
- Nav + routes: `/expenses`, `/vendors`, `/purchase-orders`
