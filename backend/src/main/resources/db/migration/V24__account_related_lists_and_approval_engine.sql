-- Batch 15: Account related lists (project/document/note) + Approval Engine domain tables

-- ——— US-S13-004: Account related lists ———
INSERT INTO sys_related_list_layout (
    id, organization_id, parent_table_id, child_table_code, label, sort_order,
    permission_code, columns_json, status, active, published_at
) VALUES
(
    'c5000001-0000-4000-8000-000000000004',
    NULL,
    'c1000001-0000-4000-8000-000000000003',
    'project',
    'Projects',
    40,
    'PROJECT_VIEW',
    '[{"field":"name","label":"Name"},{"field":"status","label":"Status"},{"field":"health","label":"Health"}]'::jsonb,
    'PUBLISHED',
    TRUE,
    NOW()
),
(
    'c5000001-0000-4000-8000-000000000005',
    NULL,
    'c1000001-0000-4000-8000-000000000003',
    'document',
    'Documents',
    50,
    'DOCUMENT_VIEW',
    '[{"field":"fileName","label":"File"},{"field":"visibility","label":"Visibility"}]'::jsonb,
    'PUBLISHED',
    TRUE,
    NOW()
),
(
    'c5000001-0000-4000-8000-000000000006',
    NULL,
    'c1000001-0000-4000-8000-000000000003',
    'note',
    'Notes',
    60,
    'NOTE_VIEW',
    '[{"field":"body","label":"Note"}]'::jsonb,
    'PUBLISHED',
    TRUE,
    NOW()
)
ON CONFLICT DO NOTHING;

-- ——— US-S14-001: Approval Engine ———
CREATE TABLE approval_workflows (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    target_type VARCHAR(64) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    CONSTRAINT uq_approval_workflow_org_code UNIQUE (organization_id, code),
    CONSTRAINT approval_workflow_target_chk CHECK (
        target_type IN ('TIMESHEET', 'PURCHASE_ORDER', 'EXPENSE', 'DEAL', 'GENERIC')
    )
);

CREATE INDEX idx_approval_workflows_org ON approval_workflows (organization_id);

CREATE TABLE approval_steps (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id),
    step_order INT NOT NULL,
    mode VARCHAR(16) NOT NULL DEFAULT 'SEQUENTIAL',
    approver_type VARCHAR(32) NOT NULL,
    approver_ref VARCHAR(128),
    required_approvals INT NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT approval_step_mode_chk CHECK (mode IN ('SEQUENTIAL', 'PARALLEL')),
    CONSTRAINT approval_step_approver_chk CHECK (
        approver_type IN ('USER', 'ROLE', 'MANAGER', 'DEPARTMENT', 'REGION')
    ),
    CONSTRAINT uq_approval_step_order UNIQUE (workflow_id, step_order)
);

CREATE INDEX idx_approval_steps_workflow ON approval_steps (workflow_id);

CREATE TABLE approval_requests (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id),
    target_type VARCHAR(64) NOT NULL,
    target_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    current_step_id UUID REFERENCES approval_steps(id),
    submitted_by UUID NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    region_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT approval_request_status_chk CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
    )
);

CREATE INDEX idx_approval_requests_org ON approval_requests (organization_id);
CREATE INDEX idx_approval_requests_target ON approval_requests (target_type, target_id);
CREATE INDEX idx_approval_requests_status ON approval_requests (organization_id, status);

CREATE UNIQUE INDEX uq_approval_request_pending_target
    ON approval_requests (organization_id, target_type, target_id)
    WHERE status = 'PENDING';

CREATE TABLE approval_actions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    request_id UUID NOT NULL REFERENCES approval_requests(id),
    step_id UUID REFERENCES approval_steps(id),
    actor_id UUID NOT NULL,
    action VARCHAR(16) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT approval_action_chk CHECK (action IN ('APPROVE', 'REJECT', 'COMMENT'))
);

CREATE INDEX idx_approval_actions_request ON approval_actions (request_id);
