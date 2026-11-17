-- Provenance is kept outside editable agent settings, including after logical deletion.
CREATE TABLE agent_creation_receipts (
    created_by TEXT NOT NULL REFERENCES agents(id),
    request_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    agent_id TEXT NOT NULL UNIQUE REFERENCES agents(id),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (created_by, request_id),
    UNIQUE (created_by, run_id),
    UNIQUE (message_id)
);

-- Rejections may have an unknown principal. No payloads, prompts, or credentials are stored.
CREATE TABLE agent_creation_audit (
    id INTEGER PRIMARY KEY,
    principal_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    claims TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
