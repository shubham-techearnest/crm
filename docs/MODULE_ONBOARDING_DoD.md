# Module onboarding DoD (Metadata Studio)

Every new CRM / delivery / finance module **must** be registered in Metadata Studio **before** shipping tenant UI.

## Checklist (DoD)

1. **`sys_table`** — insert system row (`code`, `label`, `plural`, `module_group`).
2. **`sys_field`** — seed dictionary fields (types, mandatory, references, `filterable` where needed).
3. **Layouts** — published `sys_form_layout` (CREATE at minimum) + `sys_list_layout` default columns.
4. **Table ACL** — seed `sys_table_acl` for demo/org roles (at least ORGANIZATION_ADMIN CRUD + VIEWER read).
5. **Optional** — form policies, related lists, field ACL (FLS), filterable flags for advanced filters.
6. **No hard-coded admin** — runtime forms/lists/ACL should resolve from Studio metadata.

## Sample stub

Flyway **V23** registers **`invoice`** (Finance) with fields, CREATE/list layouts, and demo org ACL — visible in Studio with **no** invoice domain API/UI yet.

## Plan link

See [PRODUCT_OPTIMIZATION_AND_V2_DELIVERY_PLAN.md](../PRODUCT_OPTIMIZATION_AND_V2_DELIVERY_PLAN.md) §5.5 and §7 (V2 commercial modules must register in Studio).
