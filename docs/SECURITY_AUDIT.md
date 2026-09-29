# Security Audit

## Authentication

| Control | Status | Notes |
| --- | --- | --- |
| JWT access HS256 | OK | 15m default TTL |
| Refresh rotation | OK | Hashed token in DB; cookie httpOnly SameSite=Lax |
| Password hashing | OK | BCrypt |
| Stack traces to client | OK | Suppressed |
| Prod JWT default secret | Fixed | `ProdSecurityGuard` fails startup on prod + default secret |
| Swagger in non-prod | Configuration | Enabled by default for development; production profile disables both Swagger UI and API docs |
| CSRF | Disabled | Intentional for SPA JWT |
| Login rate limit | Partial P1 | In-memory only |

## Multi-tenant

| Test | Result |
| --- | --- |
| Org admin cannot pass other `organizationId` for regions | PASS (`CrossTenantSecurityTest`) |
| Cross-org region GET by ID | PASS (404) |
| Services use `resolveOrganizationId` | PASS (reviewed) |

## Regional

| Test | Result |
| --- | --- |
| Pune admin cannot GET Mumbai lead | PASS |
| Pune admin cannot GET Mumbai region | PASS (`AdminIsolationTest`) |
| Lists use `regionFilterOrNull` for CRM/PM/time | PASS |

## IDOR

| Object | Guard | Result |
| --- | --- | --- |
| Lead/Account/Contact/Deal/Project/Resource/Timesheet | `assertRecordVisible` | PASS in flow tests |
| Notification mark-read | Own userId only | PASS (code) |
| Documents | Parent visibility + organization checks | List/upload/download/delete service paths verify the related parent and tenant |
| Audit logs | Organization and visible-region filters | Regional scopes are applied by the audit query service |

## RBAC / IDOR notes

- Frontend route guards added (defense in depth; API remains source of truth)
- TEAM visibility is based on same-team members and direct reports; services using single-owner scope remain narrower by design
- Self-approve timesheet blocked

## Secrets

| Item | Status |
| --- | --- |
| JWT / DB password defaults in yml | Dev convenience; must override in prod |
| No secrets committed in `.env` samples | `.env.example` pattern expected |
| Refresh tokens not returned in JSON body | Cookie only |

## Recommendations before production

1. Always run with `prod` profile + strong `JWT_SECRET` + managed DB credentials.
2. Set `SWAGGER_ENABLED=false` (or rely on prod profile).
3. Replace in-memory login limiter with Redis/shared store.
4. Review whether every audit producer records a region so region-scoped history is complete.
5. Replace in-memory login throttling before multi-instance production deployment.
