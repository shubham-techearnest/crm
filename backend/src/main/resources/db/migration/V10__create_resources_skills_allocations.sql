CREATE TABLE skills (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    name              varchar(128) NOT NULL,
    category          varchar(64),
    deleted_at        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid,
    updated_by        uuid
);

CREATE UNIQUE INDEX skills_org_name_uq ON skills (organization_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX skills_org_idx ON skills (organization_id);

CREATE TABLE resources (
    id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id            uuid NOT NULL REFERENCES organizations (id),
    region_id                  uuid NOT NULL REFERENCES regions (id),
    user_id                    uuid UNIQUE REFERENCES users (id),
    employee_code              varchar(64),
    designation                varchar(128),
    department_id              uuid REFERENCES departments (id),
    manager_id                 uuid REFERENCES users (id),
    resource_type              varchar(32) NOT NULL,
    joining_date               date,
    cost_rate                  numeric(18, 2),
    billing_rate               numeric(18, 2),
    capacity_hours_per_week    numeric(8, 2) NOT NULL DEFAULT 40,
    status                     varchar(32) NOT NULL,
    deleted_at                 timestamptz,
    created_at                 timestamptz NOT NULL DEFAULT now(),
    updated_at                 timestamptz NOT NULL DEFAULT now(),
    created_by                 uuid,
    updated_by                 uuid,
    CONSTRAINT resources_type_chk CHECK (resource_type IN (
        'EMPLOYEE', 'CONTRACTOR', 'FREELANCER', 'CONSULTANT'
    )),
    CONSTRAINT resources_status_chk CHECK (status IN (
        'AVAILABLE', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'ON_LEAVE', 'INACTIVE'
    )),
    CONSTRAINT resources_capacity_chk CHECK (capacity_hours_per_week > 0)
);

CREATE UNIQUE INDEX resources_org_code_uq
    ON resources (organization_id, employee_code)
    WHERE employee_code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX resources_org_status_idx ON resources (organization_id, status);
CREATE INDEX resources_org_region_idx ON resources (organization_id, region_id);

CREATE TABLE resource_skills (
    resource_id           uuid NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
    skill_id              uuid NOT NULL REFERENCES skills (id),
    proficiency           varchar(32) NOT NULL,
    years_of_experience   numeric(5, 1),
    PRIMARY KEY (resource_id, skill_id),
    CONSTRAINT resource_skills_proficiency_chk CHECK (proficiency IN (
        'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'
    ))
);

CREATE TABLE resource_allocations (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid NOT NULL REFERENCES organizations (id),
    project_id              uuid NOT NULL REFERENCES projects (id),
    resource_id             uuid NOT NULL REFERENCES resources (id),
    start_date              date NOT NULL,
    end_date                date NOT NULL,
    allocated_hours         numeric(12, 2),
    allocation_percentage   numeric(5, 2),
    role                    varchar(128),
    billing_rate            numeric(18, 2),
    cost_rate               numeric(18, 2),
    status                  varchar(32) NOT NULL DEFAULT 'PLANNED',
    deleted_at              timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    created_by              uuid,
    updated_by              uuid,
    CONSTRAINT resource_allocations_dates_chk CHECK (end_date >= start_date),
    CONSTRAINT resource_allocations_status_chk CHECK (status IN (
        'PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'
    )),
    CONSTRAINT resource_allocations_pct_chk CHECK (
        allocation_percentage IS NULL OR allocation_percentage >= 0
    )
);

CREATE INDEX resource_allocations_org_idx ON resource_allocations (organization_id);
CREATE INDEX resource_allocations_project_idx ON resource_allocations (project_id);
CREATE INDEX resource_allocations_resource_idx ON resource_allocations (resource_id, start_date, end_date);

ALTER TABLE project_tasks
    ADD CONSTRAINT project_tasks_assigned_resource_fk
        FOREIGN KEY (assigned_resource_id) REFERENCES resources (id);
