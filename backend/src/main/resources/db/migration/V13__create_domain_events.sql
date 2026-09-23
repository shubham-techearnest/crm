-- In-process / outbox extension point for V2 workflow. MVP listeners may write here.

CREATE TABLE domain_events (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   uuid REFERENCES organizations (id),
    event_type        varchar(128) NOT NULL,
    payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at        timestamptz NOT NULL DEFAULT now(),
    processed_at      timestamptz
);

CREATE INDEX domain_events_unprocessed_idx ON domain_events (created_at) WHERE processed_at IS NULL;
CREATE INDEX domain_events_org_idx ON domain_events (organization_id, created_at);
CREATE INDEX domain_events_type_idx ON domain_events (event_type, created_at);
