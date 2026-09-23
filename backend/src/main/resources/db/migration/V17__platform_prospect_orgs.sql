-- Platform SaaS sales prospects (not tenant leads)
CREATE TABLE platform_prospect_orgs (
    id                  UUID PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    legal_name          VARCHAR(255),
    website             VARCHAR(255),
    email               VARCHAR(255),
    phone               VARCHAR(50),
    source              VARCHAR(64),
    stage               VARCHAR(32) NOT NULL,
    estimated_arr       NUMERIC(18, 2),
    owner_user_id       UUID REFERENCES users (id),
    notes               TEXT,
    linked_organization_id UUID REFERENCES organizations (id),
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    CONSTRAINT chk_platform_prospect_stage CHECK (stage IN ('NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'))
);

CREATE INDEX idx_platform_prospect_stage ON platform_prospect_orgs (stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_platform_prospect_name ON platform_prospect_orgs (lower(name)) WHERE deleted_at IS NULL;
