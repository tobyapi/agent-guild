CREATE TABLE skill_record_cutoffs (
    job_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE
);
