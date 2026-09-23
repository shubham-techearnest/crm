CREATE TABLE documents (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    entity_type       varchar(32) NOT NULL,
    entity_id         uuid NOT NULL,
    file_name         varchar(255) NOT NULL,
    storage_key       varchar(512) NOT NULL,
    content_type      varchar(128),
    size_bytes        bigint,
    uploaded_by       uuid NOT NULL REFERENCES users (id),
    visibility        varchar(32) NOT NULL DEFAULT 'INTERNAL',
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT documents_visibility_chk CHECK (visibility IN ('INTERNAL', 'CUSTOMER'))
);

CREATE INDEX documents_entity_idx ON documents (organization_id, entity_type, entity_id);
CREATE INDEX documents_org_created_idx ON documents (organization_id, created_at);

CREATE TABLE audit_logs (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid REFERENCES organizations (id),
    user_id           uuid REFERENCES users (id),
    action            varchar(32) NOT NULL,
    entity_type       varchar(64) NOT NULL,
    entity_id         uuid,
    old_value         jsonb,
    new_value         jsonb,
    ip_address        inet,
    user_agent        varchar(255),
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT audit_logs_action_chk CHECK (action IN (
        'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'ASSIGN', 'CONVERT', 'LOGIN', 'LOGOUT'
    ))
);

CREATE INDEX audit_logs_org_created_idx ON audit_logs (organization_id, created_at);
CREATE INDEX audit_logs_entity_idx ON audit_logs (organization_id, entity_type, entity_id);
CREATE INDEX audit_logs_user_idx ON audit_logs (user_id, created_at);

CREATE TABLE notifications (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid NOT NULL REFERENCES organizations (id),
    user_id           uuid NOT NULL REFERENCES users (id),
    type              varchar(64) NOT NULL,
    title             varchar(255) NOT NULL,
    message           text NOT NULL,
    entity_type       varchar(64),
    entity_id         uuid,
    read              boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx ON notifications (user_id, read, created_at DESC);
CREATE INDEX notifications_org_idx ON notifications (organization_id, created_at);
