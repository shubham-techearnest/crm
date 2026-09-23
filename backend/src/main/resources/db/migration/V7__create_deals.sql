CREATE TABLE deals (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      uuid NOT NULL REFERENCES organizations (id),
    region_id            uuid NOT NULL REFERENCES regions (id),
    account_id           uuid NOT NULL REFERENCES accounts (id),
    contact_id           uuid REFERENCES contacts (id),
    owner_id             uuid NOT NULL REFERENCES users (id),
    lead_id              uuid REFERENCES leads (id),
    name                 varchar(255) NOT NULL,
    stage                varchar(32) NOT NULL,
    value                numeric(18, 2) NOT NULL DEFAULT 0,
    probability          numeric(5, 2) NOT NULL DEFAULT 0,
    expected_close_date  date,
    source               varchar(64),
    description          text,
    competitor           varchar(255),
    won_at               timestamptz,
    lost_at              timestamptz,
    lost_reason          varchar(255),
    deleted_at           timestamptz,
    version              bigint NOT NULL DEFAULT 0,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    created_by           uuid,
    updated_by           uuid,
    CONSTRAINT deals_stage_chk CHECK (stage IN (
        'NEW', 'QUALIFICATION', 'REQUIREMENT', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'
    )),
    CONSTRAINT deals_value_chk CHECK (value >= 0),
    CONSTRAINT deals_probability_chk CHECK (probability >= 0 AND probability <= 100)
);

CREATE INDEX deals_org_stage_idx ON deals (organization_id, stage);
CREATE INDEX deals_org_owner_idx ON deals (organization_id, owner_id);
CREATE INDEX deals_org_region_idx ON deals (organization_id, region_id);
CREATE INDEX deals_account_idx ON deals (account_id);
CREATE INDEX deals_org_created_idx ON deals (organization_id, created_at);

CREATE TABLE deal_stage_history (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    deal_id           uuid NOT NULL REFERENCES deals (id),
    from_stage        varchar(32),
    to_stage          varchar(32) NOT NULL,
    changed_by        uuid NOT NULL REFERENCES users (id),
    changed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deal_stage_history_deal_idx ON deal_stage_history (deal_id, changed_at);
CREATE INDEX deal_stage_history_org_idx ON deal_stage_history (organization_id, changed_at);

ALTER TABLE leads
    ADD CONSTRAINT leads_converted_deal_fk FOREIGN KEY (converted_deal_id) REFERENCES deals (id);
