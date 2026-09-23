# Zoho Validation Rule Matrix

**Current:** Jakarta Bean Validation on DTOs + service `BusinessException` codes; frontend Zod on forms.  
**Zoho:** Mandatory fields, layout rules, workflow criteria, approval locking ([S5](https://help.zoho.com/portal/en/kb/crm/faqs/customization/articles/faqs-field-customization), [S6](https://help.zoho.com/portal/en/kb/crm/automate-business-processes/workflows/articles/configuring-workflow-rules), [S7](https://help.zoho.com/portal/en/kb/crm/process-management/approval-process/articles/add-approval-process)).

| Rule class | Zoho | Current | Gap | Priority | Decision |
| --- | --- | --- | --- | --- | --- |
| Required fields | Layout mandatory | Zod/Bean @NotBlank | OK for create; weak conditional | P1 | IMPROVE |
| Email format | Yes | @Email / zod email | OK | — | KEEP |
| Phone format | Country rules | Loose string | Weak | P2 | IMPROVE |
| Numeric/currency range | Yes | Hours 0–24; money unconstrained | Deal value ≥0 | P2 | ADD |
| Date / date range | Yes | Allocation end≥start | Expand | P1 | IMPROVE |
| Duplicate | Duplicate rules | Convert account/contact reuse | Lead/vendor create warn | P1 | ADD |
| Conditional required | Layout rules | Almost none | Deal WON→close date; LOST→reason | P1 | ADD |
| Cross-field | Criteria | Few | Expense type→fields (V2) | V2 | V2 |
| Lookup org/region | Implicit | TenantAccess | Lookup APIs must filter | P0 | ENFORCE in lookups |
| Status transition | Blueprint | Deal stages validated list | Lead/Project transitions soft | P1 | ADD matrix |
| Ownership assign | Permissions | LEAD_ASSIGN | Expand DEAL_ASSIGN | P1 | ADD |
| Region on create | Territory | regionId required CRM | Keep | — | KEEP |
| Permission-based field edit | FLS | Module only | Cost rates | P1 | ADD FLS |
| Approval lock | Pending lock | Timesheet editable when draft/rejected | Invoice issue lock (V2) | V2 | V2 |
| Business: convert rules | Mapping | COMPANY_REQUIRED | OK | — | KEEP |
| Business: OVER_ALLOCATED | — | Yes | Keep | — | DIFFERENTIATE |

### Architectural representation (do not implement yet)

```text
ValidationRule { module, when: ConditionTree, then: Require|Forbid|Warn|BlockTransition }
TransitionRule { entity, from, to, guards[] }
DuplicateRule { module, matchFields[], mode: WARN|BLOCK }
```

Evaluate server-side always; mirror subset in Zod for UX.

### Scorecard

12 rule classes in-scope: ~4 solid, ~5 partial, ~3 missing → **~54%**.
