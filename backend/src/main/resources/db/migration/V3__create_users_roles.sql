-- Permissions (global catalog), roles, users, and assignment tables.
-- teams.manager_id and users.team_id FKs are added after both tables exist.

CREATE TABLE permissions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code         varchar(64) NOT NULL,
    module       varchar(64) NOT NULL,
    description  varchar(255) NOT NULL,
    CONSTRAINT permissions_code_uq UNIQUE (code)
);

CREATE TABLE roles (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid REFERENCES organizations (id),
    code             varchar(64) NOT NULL,
    name             varchar(128) NOT NULL,
    data_scope       varchar(32) NOT NULL,
    is_system        boolean NOT NULL DEFAULT false,
    deleted_at       timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid,
    updated_by       uuid,
    CONSTRAINT roles_data_scope_chk CHECK (data_scope IN (
        'PLATFORM', 'ORGANIZATION', 'REGION', 'DEPARTMENT', 'TEAM', 'OWN'
    ))
);

CREATE UNIQUE INDEX roles_platform_code_uq ON roles (code) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX roles_org_code_uq ON roles (organization_id, code) WHERE organization_id IS NOT NULL;
CREATE INDEX roles_org_idx ON roles (organization_id);

CREATE TABLE role_permissions (
    role_id        uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_id  uuid NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid REFERENCES organizations (id),
    region_id        uuid REFERENCES regions (id),
    branch_id        uuid REFERENCES branches (id),
    department_id    uuid REFERENCES departments (id),
    team_id          uuid,
    manager_id       uuid REFERENCES users (id),
    email            varchar(255) NOT NULL,
    password_hash    varchar(255) NOT NULL,
    first_name       varchar(100) NOT NULL,
    last_name        varchar(100) NOT NULL,
    phone            varchar(50),
    status           varchar(32) NOT NULL,
    last_login_at    timestamptz,
    deleted_at       timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid,
    updated_by       uuid,
    CONSTRAINT users_status_chk CHECK (status IN ('INVITED', 'ACTIVE', 'LOCKED', 'DEACTIVATED'))
);

CREATE UNIQUE INDEX users_org_email_uq
    ON users (organization_id, lower(email))
    WHERE organization_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX users_platform_email_uq
    ON users (lower(email))
    WHERE organization_id IS NULL AND deleted_at IS NULL;
CREATE INDEX users_org_idx ON users (organization_id);
CREATE INDEX users_region_idx ON users (region_id);
CREATE INDEX users_status_idx ON users (organization_id, status);
CREATE INDEX users_created_idx ON users (organization_id, created_at);

ALTER TABLE users
    ADD CONSTRAINT users_team_fk FOREIGN KEY (team_id) REFERENCES teams (id);

ALTER TABLE teams
    ADD CONSTRAINT teams_manager_fk FOREIGN KEY (manager_id) REFERENCES users (id);

CREATE TABLE user_roles (
    user_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id  uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_regions (
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    region_id  uuid NOT NULL REFERENCES regions (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, region_id)
);
