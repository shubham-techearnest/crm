CREATE TABLE activities (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       uuid NOT NULL REFERENCES organizations (id),
    region_id             uuid REFERENCES regions (id),
    type                  varchar(32) NOT NULL,
    subject               varchar(255) NOT NULL,
    description           text,
    status                varchar(32) NOT NULL,
    priority              varchar(16),
    due_date              timestamptz,
    assigned_to           uuid REFERENCES users (id),
    related_entity_type   varchar(32) NOT NULL,
    related_entity_id     uuid NOT NULL,
    completed_at          timestamptz,
    deleted_at            timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    created_by            uuid,
    updated_by            uuid,
    CONSTRAINT activities_type_chk CHECK (type IN ('TASK', 'CALL', 'MEETING', 'NOTE', 'FOLLOW_UP')),
    CONSTRAINT activities_status_chk CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT activities_priority_chk CHECK (priority IS NULL OR priority IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT activities_related_chk CHECK (related_entity_type IN (
        'LEAD', 'CONTACT', 'ACCOUNT', 'DEAL', 'PROJECT'
    ))
);

CREATE INDEX activities_related_idx ON activities (organization_id, related_entity_type, related_entity_id);
CREATE INDEX activities_assignee_idx ON activities (assigned_to, status);
CREATE INDEX activities_org_status_idx ON activities (organization_id, status);
CREATE INDEX activities_due_idx ON activities (organization_id, due_date);
