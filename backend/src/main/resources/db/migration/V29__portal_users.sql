-- US-S25-001: Customer portal users (separate from internal users)
CREATE TABLE portal_users (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT portal_users_status_chk CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uq_portal_users_org_email UNIQUE (organization_id, email)
);

CREATE INDEX idx_portal_users_account ON portal_users (account_id) WHERE deleted_at IS NULL;

-- Demo portal user for Horizon Retail (password same as demo internal users)
INSERT INTO portal_users (
    id, organization_id, account_id, email, password_hash, first_name, last_name, status
) VALUES (
    '99999999-9999-4999-8999-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-000000000001',
    'portal@horizon-retail.example.com',
    '$2a$12$cgvJnrKl0NRx/R/xqUZk1OAiZzSAkjmogcc4BHN8h.ygKP9pttflS',
    'Portal',
    'Customer',
    'ACTIVE'
);
