CREATE TABLE leads (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid NOT NULL REFERENCES organizations (id),
    region_id               uuid NOT NULL REFERENCES regions (id),
    owner_id                uuid NOT NULL REFERENCES users (id),
    first_name              varchar(100),
    last_name               varchar(100),
    company_name            varchar(255),
    email                   varchar(255),
    phone                   varchar(50),
    website                 varchar(255),
    source                  varchar(64),
    status                  varchar(32) NOT NULL,
    priority                varchar(16),
    industry                varchar(64),
    designation             varchar(128),
    estimated_value         numeric(18, 2),
    expected_close_date     date,
    description             text,
    converted_account_id    uuid,
    converted_contact_id    uuid,
    converted_deal_id       uuid,
    converted_at            timestamptz,
    deleted_at              timestamptz,
    version                 bigint NOT NULL DEFAULT 0,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    created_by              uuid,
    updated_by              uuid,
    CONSTRAINT leads_status_chk CHECK (status IN (
        'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CONVERTED', 'LOST'
    )),
    CONSTRAINT leads_priority_chk CHECK (priority IS NULL OR priority IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT leads_value_chk CHECK (estimated_value IS NULL OR estimated_value >= 0)
);

CREATE INDEX leads_org_status_idx ON leads (organization_id, status);
CREATE INDEX leads_org_owner_idx ON leads (organization_id, owner_id);
CREATE INDEX leads_org_region_idx ON leads (organization_id, region_id);
CREATE INDEX leads_org_created_idx ON leads (organization_id, created_at);
CREATE INDEX leads_org_email_idx ON leads (organization_id, lower(email));
