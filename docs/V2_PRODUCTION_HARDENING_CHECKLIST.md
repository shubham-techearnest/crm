# V2 production hardening checklist

Use before promoting TechEarnest CRM V2 beyond demo/staging.

## Security

- [ ] Rotate demo passwords (`ChangeMe!123`) and disable seed users in production
- [ ] Confirm JWT secret is environment-specific and not committed
- [ ] Verify portal tokens (`aud=PORTAL`) cannot call internal `/api/v1/*` tenant routes
- [ ] Run `V2CrossTenantIsolationTest` and region isolation tests in CI
- [ ] Review CORS and `SecurityConfig` permit lists for portal login only

## Data & tenancy

- [ ] Organization scoping enforced on all V2 modules (finance, procurement, expenses, reports, portal)
- [ ] Region filters applied on list/search endpoints for Pune/Mumbai demo roles
- [ ] Soft-delete respected (`deleted_at is null`) on all read paths

## Operations

- [ ] Database migrations applied through latest Flyway version (V29+ portal users)
- [ ] Outbox processor running for workflow/deal events
- [ ] Audit logs retained per org policy
- [ ] Backups configured for PostgreSQL

## Observability

- [ ] Health endpoint monitored (`/actuator/health`)
- [ ] Error rates on auth, approvals, and report endpoints tracked
- [ ] Log correlation id present on API requests (if enabled in deployment)

## Release gate

- [ ] MVP golden path manual checklist completed (`docs/MVP_GOLDEN_PATH_TEST.md`)
- [ ] Portal login smoke test with demo portal user
- [ ] Finance nav permissions verified for org admin vs employee roles
