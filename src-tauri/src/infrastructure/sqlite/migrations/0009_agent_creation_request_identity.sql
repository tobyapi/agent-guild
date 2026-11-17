-- A run may produce distinct requests; only request and source-message identity are idempotent.
CREATE TABLE agent_creation_receipts_new (
    created_by TEXT NOT NULL REFERENCES agents(id),
    request_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    agent_id TEXT NOT NULL UNIQUE REFERENCES agents(id),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (created_by, request_id),
    UNIQUE (message_id)
);
INSERT INTO agent_creation_receipts_new
    (created_by, request_id, run_id, message_id, agent_id, created_at)
SELECT created_by, request_id, run_id, message_id, agent_id, created_at
FROM agent_creation_receipts;
DROP TABLE agent_creation_receipts;
ALTER TABLE agent_creation_receipts_new RENAME TO agent_creation_receipts;
