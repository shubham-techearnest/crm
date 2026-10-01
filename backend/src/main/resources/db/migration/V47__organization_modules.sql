-- Per-organization module entitlements managed by the platform (Super Admin).
-- A missing row means the module is enabled, so existing organizations keep every module.

CREATE TABLE organization_modules (
    organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    module_code VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    PRIMARY KEY (organization_id, module_code)
);
