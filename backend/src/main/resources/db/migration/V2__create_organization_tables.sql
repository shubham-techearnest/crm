-- MVP organization hierarchy: organization → region → branch → department → team.

CREATE TABLE organizations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(255) NOT NULL,
    slug            varchar(100) NOT NULL,
    legal_name      varchar(255),
    email           varchar(255),
    phone           varchar(50),
    website         varchar(255),
    timezone        varchar(64) NOT NULL DEFAULT 'Asia/Kolkata',
    locale          varchar(16) NOT NULL DEFAULT 'en-IN',
    currency_code   char(3) NOT NULL DEFAULT 'INR',
    status          varchar(32) NOT NULL,
    deleted_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid,
    updated_by      uuid,
    CONSTRAINT organizations_slug_uq UNIQUE (slug),
    CONSTRAINT organizations_status_chk CHECK (status IN ('ACTIVE', 'SUSPENDED'))
);

CREATE TABLE regions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES organizations (id),
    parent_id        uuid REFERENCES regions (id),
    name             varchar(128) NOT NULL,
    code             varchar(32) NOT NULL,
    status           varchar(32) NOT NULL,
    deleted_at       timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid,
    updated_by       uuid,
    CONSTRAINT regions_org_code_uq UNIQUE (organization_id, code),
    CONSTRAINT regions_status_chk CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX regions_org_idx ON regions (organization_id);
CREATE INDEX regions_parent_idx ON regions (parent_id);
CREATE INDEX regions_status_idx ON regions (organization_id, status);

CREATE TABLE branches (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES organizations (id),
    region_id        uuid NOT NULL REFERENCES regions (id),
    name             varchar(128) NOT NULL,
    address          text,
    status           varchar(32) NOT NULL DEFAULT 'ACTIVE',
    deleted_at       timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid,
    updated_by       uuid,
    CONSTRAINT branches_status_chk CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX branches_org_idx ON branches (organization_id);
CREATE INDEX branches_region_idx ON branches (region_id);

CREATE TABLE departments (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES organizations (id),
    branch_id        uuid REFERENCES branches (id),
    name             varchar(128) NOT NULL,
    status           varchar(32) NOT NULL DEFAULT 'ACTIVE',
    deleted_at       timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid,
    updated_by       uuid,
    CONSTRAINT departments_status_chk CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX departments_org_idx ON departments (organization_id);
CREATE INDEX departments_branch_idx ON departments (branch_id);

CREATE TABLE teams (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES organizations (id),
    department_id    uuid NOT NULL REFERENCES departments (id),
    manager_id       uuid,
    name             varchar(128) NOT NULL,
    deleted_at       timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    created_by       uuid,
    updated_by       uuid
);

CREATE INDEX teams_org_idx ON teams (organization_id);
CREATE INDEX teams_department_idx ON teams (department_id);
