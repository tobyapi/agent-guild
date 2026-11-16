//! Cancellation markers belong to jobs; saved messages are never changed.
use std::sync::Arc;

use guild_application::ports::SkillRecordRepository;
use guild_application::AppResult;
use guild_domain::ids::ChannelId;
use rusqlite::params;

use super::{codec::storage, Database};

pub struct SqliteSkillRecordRepository {
    db: Arc<Database>,
}

impl SqliteSkillRecordRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl SkillRecordRepository for SqliteSkillRecordRepository {
    fn truncate(&self, job_id: &str, channel: &ChannelId) -> AppResult<()> {
        self.db
            .with(|conn| {
                conn.execute(
                    "INSERT INTO skill_record_cutoffs (job_id, channel_id)
                 SELECT ?1, id FROM channels WHERE id = ?2 ON CONFLICT DO NOTHING",
                    params![job_id, channel.as_str()],
                )?;
                Ok(())
            })
            .map_err(storage)
    }

    fn is_truncated(&self, job_id: &str) -> AppResult<bool> {
        self.db
            .with(|conn| {
                conn.query_row("SELECT EXISTS(SELECT 1 FROM skill_record_cutoffs WHERE job_id = ?1)", [job_id], |row| {
                    row.get(0)
                })
            })
            .map_err(storage)
    }
}
