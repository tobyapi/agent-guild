CREATE TABLE run_measurements (
  job_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  backend TEXT NOT NULL,
  model TEXT,
  started_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_nano_usd INTEGER
);
CREATE INDEX run_measurements_channel_model ON run_measurements (channel_id, backend, model);
