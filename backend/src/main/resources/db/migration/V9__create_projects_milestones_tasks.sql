CREATE TABLE projects (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      uuid NOT NULL REFERENCES organizations (id),
    region_id            uuid NOT NULL REFERENCES regions (id),
    account_id           uuid NOT NULL REFERENCES accounts (id),
    deal_id              uuid REFERENCES deals (id),
    project_manager_id   uuid NOT NULL REFERENCES users (id),
    name                 varchar(255) NOT NULL,
    project_code         varchar(64) NOT NULL,
    description          text,
    status               varchar(32) NOT NULL,
    priority             varchar(16),
    start_date           date,
    end_date             date,
    budget               numeric(18, 2),
    estimated_hours      numeric(12, 2),
    actual_hours         numeric(12, 2) NOT NULL DEFAULT 0,
    billing_type         varchar(32) NOT NULL,
    deleted_at           timestamptz,
    version              bigint NOT NULL DEFAULT 0,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    created_by           uuid,
    updated_by           uuid,
    CONSTRAINT projects_org_code_uq UNIQUE (organization_id, project_code),
    CONSTRAINT projects_status_chk CHECK (status IN (
        'PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'
    )),
    CONSTRAINT projects_priority_chk CHECK (priority IS NULL OR priority IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT projects_billing_chk CHECK (billing_type IN (
        'FIXED_PRICE', 'HOURLY', 'MILESTONE', 'RETAINER'
    )),
    CONSTRAINT projects_dates_chk CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX projects_org_status_idx ON projects (organization_id, status);
CREATE INDEX projects_org_region_idx ON projects (organization_id, region_id);
CREATE INDEX projects_account_idx ON projects (account_id);
CREATE INDEX projects_pm_idx ON projects (project_manager_id);
CREATE INDEX projects_org_created_idx ON projects (organization_id, created_at);

CREATE TABLE milestones (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    project_id        uuid NOT NULL REFERENCES projects (id),
    name              varchar(255) NOT NULL,
    description       text,
    due_date          date,
    status            varchar(32) NOT NULL DEFAULT 'PLANNED',
    sort_order        int NOT NULL DEFAULT 0,
    deleted_at        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid,
    updated_by        uuid,
    CONSTRAINT milestones_status_chk CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX milestones_project_idx ON milestones (project_id, sort_order);
CREATE INDEX milestones_org_idx ON milestones (organization_id);

CREATE TABLE project_tasks (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid NOT NULL REFERENCES organizations (id),
    project_id              uuid NOT NULL REFERENCES projects (id),
    milestone_id            uuid REFERENCES milestones (id),
    parent_task_id          uuid REFERENCES project_tasks (id),
    assigned_resource_id    uuid,
    name                    varchar(255) NOT NULL,
    description             text,
    status                  varchar(32) NOT NULL,
    priority                varchar(16),
    start_date              date,
    due_date                date,
    estimated_hours         numeric(12, 2),
    actual_hours            numeric(12, 2) NOT NULL DEFAULT 0,
    completion_percentage   numeric(5, 2) NOT NULL DEFAULT 0,
    deleted_at              timestamptz,
    version                 bigint NOT NULL DEFAULT 0,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    created_by              uuid,
    updated_by              uuid,
    CONSTRAINT project_tasks_status_chk CHECK (status IN (
        'TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'
    )),
    CONSTRAINT project_tasks_priority_chk CHECK (priority IS NULL OR priority IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT project_tasks_pct_chk CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
);

CREATE INDEX project_tasks_project_idx ON project_tasks (project_id, status);
CREATE INDEX project_tasks_org_idx ON project_tasks (organization_id);
CREATE INDEX project_tasks_assignee_idx ON project_tasks (assigned_resource_id);
CREATE INDEX project_tasks_parent_idx ON project_tasks (parent_task_id);

CREATE TABLE task_dependencies (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id        uuid NOT NULL REFERENCES organizations (id),
    predecessor_task_id    uuid NOT NULL REFERENCES project_tasks (id),
    successor_task_id      uuid NOT NULL REFERENCES project_tasks (id),
    type                   varchar(32) NOT NULL DEFAULT 'FINISH_TO_START',
    CONSTRAINT task_dependencies_pair_uq UNIQUE (predecessor_task_id, successor_task_id),
    CONSTRAINT task_dependencies_type_chk CHECK (type IN ('FINISH_TO_START')),
    CONSTRAINT task_dependencies_no_self CHECK (predecessor_task_id <> successor_task_id)
);

CREATE INDEX task_dependencies_org_idx ON task_dependencies (organization_id);

CREATE TABLE task_comments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    task_id           uuid NOT NULL REFERENCES project_tasks (id),
    author_id         uuid NOT NULL REFERENCES users (id),
    body              text NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_comments_task_idx ON task_comments (task_id, created_at);
