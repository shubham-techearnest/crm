CREATE TABLE accounts (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    region_id         uuid NOT NULL REFERENCES regions (id),
    owner_id          uuid NOT NULL REFERENCES users (id),
    name              varchar(255) NOT NULL,
    industry          varchar(64),
    website           varchar(255),
    email             varchar(255),
    phone             varchar(50),
    billing_address   jsonb,
    shipping_address  jsonb,
    tax_number        varchar(64),
    status            varchar(32) NOT NULL DEFAULT 'ACTIVE',
    account_type      varchar(32) NOT NULL,
    description       text,
    deleted_at        timestamptz,
    version           bigint NOT NULL DEFAULT 0,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid,
    updated_by        uuid,
    CONSTRAINT accounts_status_chk CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT accounts_type_chk CHECK (account_type IN (
        'PROSPECT', 'CUSTOMER', 'PARTNER', 'VENDOR', 'OTHER'
    ))
);

CREATE INDEX accounts_org_status_idx ON accounts (organization_id, status);
CREATE INDEX accounts_org_owner_idx ON accounts (organization_id, owner_id);
CREATE INDEX accounts_org_region_idx ON accounts (organization_id, region_id);
CREATE INDEX accounts_org_created_idx ON accounts (organization_id, created_at);
CREATE INDEX accounts_org_name_idx ON accounts (organization_id, lower(name));

CREATE TABLE contacts (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    region_id         uuid NOT NULL REFERENCES regions (id),
    account_id        uuid NOT NULL REFERENCES accounts (id),
    owner_id          uuid NOT NULL REFERENCES users (id),
    first_name        varchar(100) NOT NULL,
    last_name         varchar(100) NOT NULL,
    email             varchar(255),
    phone             varchar(50),
    mobile            varchar(50),
    designation       varchar(128),
    department        varchar(128),
    linkedin_url      varchar(255),
    status            varchar(32) NOT NULL DEFAULT 'ACTIVE',
    notes             text,
    deleted_at        timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid,
    updated_by        uuid,
    CONSTRAINT contacts_status_chk CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX contacts_org_idx ON contacts (organization_id);
CREATE INDEX contacts_account_idx ON contacts (account_id);
CREATE INDEX contacts_owner_idx ON contacts (organization_id, owner_id);
CREATE INDEX contacts_region_idx ON contacts (organization_id, region_id);
CREATE INDEX contacts_created_idx ON contacts (organization_id, created_at);

ALTER TABLE leads
    ADD CONSTRAINT leads_converted_account_fk FOREIGN KEY (converted_account_id) REFERENCES accounts (id),
    ADD CONSTRAINT leads_converted_contact_fk FOREIGN KEY (converted_contact_id) REFERENCES contacts (id);
