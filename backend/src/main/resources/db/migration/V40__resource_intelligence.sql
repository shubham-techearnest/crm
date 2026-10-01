-- Resource intelligence: configurable resource types, full resource profile and engagement terms, leave /
-- unavailability, richer allocations, rate stamps on approved time and per-organization board thresholds.

-- 1. Resource types become a lookup table so new categories can be added without a code change.
CREATE TABLE resource_types (
    code           varchar(32) PRIMARY KEY,
    name           varchar(64) NOT NULL,
    category       varchar(16) NOT NULL,
    code_prefix    varchar(8)  NOT NULL,
    requires_user  boolean     NOT NULL DEFAULT false,
    sort_order     int         NOT NULL DEFAULT 0,
    active         boolean     NOT NULL DEFAULT true,
    CONSTRAINT resource_types_category_chk CHECK (category IN ('INTERNAL', 'EXTERNAL')),
    CONSTRAINT resource_types_prefix_chk CHECK (code_prefix ~ '^[A-Z]{2,8}$')
);

INSERT INTO resource_types (code, name, category, code_prefix, requires_user, sort_order) VALUES
    ('EMPLOYEE',       'Employee',          'INTERNAL', 'EMP', true,  10),
    ('CONTRACTOR',     'Contractor',        'EXTERNAL', 'CON', false, 20),
    ('CONSULTANT',     'Consultant',        'EXTERNAL', 'CON', false, 30),
    ('FREELANCER',     'Freelancer',        'EXTERNAL', 'FRL', false, 40),
    ('OTHER_EXTERNAL', 'External Resource', 'EXTERNAL', 'EXT', false, 50);

ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_type_chk;
ALTER TABLE resources
    ADD CONSTRAINT resources_type_fk FOREIGN KEY (resource_type) REFERENCES resource_types (code);

-- 2. Resource profile, capacity model and engagement terms.
ALTER TABLE resources
    ADD COLUMN engagement_start_date  date,
    ADD COLUMN contract_reference     varchar(128),
    ADD COLUMN vendor_id              uuid REFERENCES vendors (id),
    ADD COLUMN working_hours_per_day  numeric(4, 2) NOT NULL DEFAULT 8,
    ADD COLUMN working_days_per_week  numeric(3, 1) NOT NULL DEFAULT 5,
    ADD COLUMN experience_years       numeric(4, 1),
    ADD COLUMN location               varchar(128),
    ADD COLUMN available_from         date,
    ADD COLUMN billable               boolean NOT NULL DEFAULT true,
    ADD COLUMN rate_unit              varchar(16) NOT NULL DEFAULT 'HOURLY',
    ADD COLUMN deactivated_at         timestamptz,
    ADD COLUMN deactivation_reason    varchar(500),
    ADD CONSTRAINT resources_hours_per_day_chk CHECK (working_hours_per_day > 0 AND working_hours_per_day <= 24),
    ADD CONSTRAINT resources_days_per_week_chk CHECK (working_days_per_week > 0 AND working_days_per_week <= 7),
    ADD CONSTRAINT resources_experience_chk CHECK (experience_years IS NULL OR experience_years >= 0),
    ADD CONSTRAINT resources_rate_unit_chk CHECK (rate_unit IN ('HOURLY', 'DAILY', 'MONTHLY')),
    ADD CONSTRAINT resources_rates_chk CHECK (
        (cost_rate IS NULL OR cost_rate >= 0) AND (billing_rate IS NULL OR billing_rate >= 0)),
    ADD CONSTRAINT resources_engagement_dates_chk CHECK (
        engagement_start_date IS NULL OR engagement_end_date IS NULL OR engagement_end_date >= engagement_start_date);

-- Existing weekly capacity stays authoritative; split it into the 5-day default.
UPDATE resources
SET working_hours_per_day = LEAST(24, GREATEST(0.5, round(capacity_hours_per_week / 5, 2)));

UPDATE resources SET engagement_start_date = joining_date
WHERE resource_type <> 'EMPLOYEE' AND joining_date IS NOT NULL;

-- Stored status keeps only states a person sets; allocation states are recalculated from allocations.
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_status_chk;
ALTER TABLE resources ADD CONSTRAINT resources_status_chk CHECK (status IN (
    'AVAILABLE', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED',
    'ON_LEAVE', 'UNAVAILABLE', 'INACTIVE', 'CONTRACT_EXPIRED', 'TERMINATED'
));

CREATE INDEX resources_org_type_idx ON resources (organization_id, resource_type) WHERE deleted_at IS NULL;
CREATE INDEX resources_vendor_idx ON resources (vendor_id) WHERE vendor_id IS NOT NULL;

-- 3. Skills: primary flag and certification.
ALTER TABLE resource_skills
    ADD COLUMN is_primary     boolean NOT NULL DEFAULT false,
    ADD COLUMN certification  varchar(200);

CREATE INDEX resource_skills_skill_idx ON resource_skills (skill_id);

-- 4. Allocations: billable flag, origin, notes, optional milestone and who ended it.
ALTER TABLE resource_allocations
    ADD COLUMN billable      boolean NOT NULL DEFAULT true,
    ADD COLUMN source        varchar(32) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN notes         varchar(1000),
    ADD COLUMN milestone_id  uuid REFERENCES milestones (id),
    ADD COLUMN ended_at      timestamptz,
    ADD COLUMN ended_by      uuid REFERENCES users (id),
    ADD CONSTRAINT resource_allocations_source_chk CHECK (source IN ('MANUAL', 'ONBOARDING', 'IMPORT', 'PROJECT')),
    ADD CONSTRAINT resource_allocations_rates_chk CHECK (
        (cost_rate IS NULL OR cost_rate >= 0) AND (billing_rate IS NULL OR billing_rate >= 0)),
    ADD CONSTRAINT resource_allocations_hours_chk CHECK (allocated_hours IS NULL OR allocated_hours >= 0);

CREATE INDEX resource_allocations_org_window_idx
    ON resource_allocations (organization_id, status, start_date, end_date) WHERE deleted_at IS NULL;

-- 5. Leave and other unavailability; reduces capacity on the board.
CREATE TABLE resource_unavailability (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES organizations (id),
    resource_id      uuid NOT NULL REFERENCES resources (id),
    start_date       date NOT NULL,
    end_date         date NOT NULL,
    kind             varchar(16) NOT NULL DEFAULT 'LEAVE',
    hours_per_day    numeric(4, 2),
    reason           varchar(500),
    deleted_at       timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid,
    updated_by       uuid,
    CONSTRAINT resource_unavailability_dates_chk CHECK (end_date >= start_date),
    CONSTRAINT resource_unavailability_kind_chk CHECK (kind IN ('LEAVE', 'HOLIDAY', 'SICK', 'TRAINING', 'OTHER')),
    CONSTRAINT resource_unavailability_hours_chk CHECK (hours_per_day IS NULL OR (hours_per_day > 0 AND hours_per_day <= 24))
);

CREATE INDEX resource_unavailability_resource_idx
    ON resource_unavailability (resource_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX resource_unavailability_org_idx ON resource_unavailability (organization_id) WHERE deleted_at IS NULL;

-- 6. Approved time carries the rates and allocation it was costed with, so later rate changes never rewrite history.
ALTER TABLE time_entries
    ADD COLUMN cost_rate      numeric(18, 2),
    ADD COLUMN allocation_id  uuid REFERENCES resource_allocations (id);

CREATE INDEX time_entries_allocation_idx ON time_entries (allocation_id) WHERE allocation_id IS NOT NULL;
CREATE INDEX time_entries_org_date_idx ON time_entries (organization_id, work_date) WHERE deleted_at IS NULL;

WITH matched AS (
    SELECT DISTINCT ON (e.id)
           e.id AS entry_id, a.id AS allocation_id, a.cost_rate AS a_cost, a.billing_rate AS a_bill,
           r.cost_rate AS r_cost, r.billing_rate AS r_bill
    FROM time_entries e
    JOIN timesheets t ON t.id = e.timesheet_id AND t.status = 'APPROVED'
    JOIN resources r ON r.id = t.resource_id
    LEFT JOIN resource_allocations a
           ON a.resource_id = t.resource_id
          AND a.project_id = e.project_id
          AND a.deleted_at IS NULL
          AND a.status <> 'CANCELLED'
          AND e.work_date BETWEEN a.start_date AND a.end_date
    WHERE e.deleted_at IS NULL
    ORDER BY e.id, a.start_date DESC NULLS LAST
)
UPDATE time_entries e
SET allocation_id = matched.allocation_id,
    cost_rate     = COALESCE(matched.a_cost, matched.r_cost),
    billing_rate  = COALESCE(e.billing_rate, matched.a_bill, matched.r_bill)
FROM matched
WHERE e.id = matched.entry_id;

-- 7. Per-organization thresholds used to classify resources on the board.
CREATE TABLE resource_board_settings (
    organization_id            uuid PRIMARY KEY REFERENCES organizations (id),
    ending_soon_days           int NOT NULL DEFAULT 14,
    bench_max_allocation_pct   numeric(5, 2) NOT NULL DEFAULT 0,
    full_allocation_pct        numeric(5, 2) NOT NULL DEFAULT 100,
    overallocation_pct         numeric(5, 2) NOT NULL DEFAULT 100,
    forecast_weeks             int NOT NULL DEFAULT 12,
    created_at                 timestamptz NOT NULL DEFAULT now(),
    updated_at                 timestamptz NOT NULL DEFAULT now(),
    created_by                 uuid,
    updated_by                 uuid,
    CONSTRAINT resource_board_settings_days_chk CHECK (ending_soon_days BETWEEN 1 AND 365),
    CONSTRAINT resource_board_settings_weeks_chk CHECK (forecast_weeks BETWEEN 1 AND 52),
    CONSTRAINT resource_board_settings_pct_chk CHECK (
        bench_max_allocation_pct >= 0
        AND full_allocation_pct > bench_max_allocation_pct
        AND overallocation_pct >= full_allocation_pct
        AND overallocation_pct <= 500)
);

-- 8. Permissions and audit actions.
INSERT INTO permissions (code, module, description) VALUES
    ('RESOURCE_BOARD_VIEW', 'resource', 'View the organization resource whiteboard'),
    ('RESOURCE_BOARD_CONFIGURE', 'resource', 'Change resource whiteboard thresholds')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'RESOURCE_BOARD_VIEW'
WHERE r.deleted_at IS NULL
  AND r.code IN ('SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'REGIONAL_ADMIN', 'PROJECT_MANAGER',
                 'RESOURCE_MANAGER', 'FINANCE_USER', 'VIEWER')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'RESOURCE_BOARD_CONFIGURE'
WHERE r.deleted_at IS NULL
  AND r.code IN ('SUPER_ADMIN', 'ORGANIZATION_ADMIN', 'RESOURCE_MANAGER')
ON CONFLICT DO NOTHING;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_chk;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_chk CHECK (action IN (
    'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'ASSIGN', 'CONVERT',
    'LOGIN', 'LOGOUT', 'EXECUTE',
    'PORTAL_INVITE', 'PORTAL_ACCESS', 'PORTAL_REVOKE', 'ACCEPT_INVITE',
    'ISSUE_LINK', 'SUBMIT_VIA_LINK',
    'DEACTIVATE', 'REACTIVATE', 'END'
));
