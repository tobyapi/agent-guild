//! 割り振りのリポジトリ。サブタスクは subtasks 表（書かれた順は position）。チャンネルを消すと一緒に消える。

use std::sync::Arc;

use guild_application::ports::DelegationRepository;
use guild_application::AppResult;
use guild_domain::delegation::{Delegation, DelegationStatus, SubtaskStatus};
use guild_domain::ids::{ChannelId, DelegationId};
use rusqlite::{params, OptionalExtension};

use super::codec::storage;
use super::database::Database;
use super::delegation_rows::{insert_rows, read_delegation, subtasks_of, update_rows, COLUMNS};

pub struct SqliteDelegationRepository {
    db: Arc<Database>,
}

impl SqliteDelegationRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl DelegationRepository for SqliteDelegationRepository {
    fn insert(&self, delegation: &Delegation) -> AppResult<()> {
        self.db
            .with(|conn| {
                let tx = conn.unchecked_transaction()?;
                insert_rows(&tx, delegation)?;
                tx.commit()
            })
            .map_err(storage)
    }

    fn update(&self, delegation: &Delegation) -> AppResult<()> {
        self.db
            .with(|conn| {
                let tx = conn.unchecked_transaction()?;
                update_rows(&tx, delegation)?;
                tx.commit()
            })
            .map_err(storage)
    }

    fn get(&self, id: &DelegationId) -> AppResult<Option<Delegation>> {
        self.db
            .with(|conn| {
                let sql = format!("SELECT {COLUMNS} FROM delegations WHERE id = ?1");
                let Some(mut delegation) = conn.query_row(&sql, [id.as_str()], read_delegation).optional()? else {
                    return Ok(None);
                };
                delegation.subtasks = subtasks_of(conn, &delegation.id)?;
                Ok(Some(delegation))
            })
            .map_err(storage)
    }

    fn list(&self, channel: &ChannelId, limit: usize) -> AppResult<Vec<Delegation>> {
        let limit = i64::try_from(limit).unwrap_or(i64::MAX);
        self.db
            .with(|conn| {
                let sql = format!(
                    "SELECT {COLUMNS} FROM delegations WHERE channel_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT ?2"
                );
                let mut delegations: Vec<Delegation> = conn
                    .prepare(&sql)?
                    .query_map(params![channel.as_str(), limit], read_delegation)?
                    .collect::<rusqlite::Result<_>>()?;
                delegations.reverse();
                for delegation in &mut delegations {
                    delegation.subtasks = subtasks_of(conn, &delegation.id)?;
                }
                Ok(delegations)
            })
            .map_err(storage)
    }

    fn cancel_unfinished(&self, now: i64) -> AppResult<usize> {
        let (running, reporting) = (DelegationStatus::Running.as_str(), DelegationStatus::Reporting.as_str());
        self.db
            .with(|conn| {
                let tx = conn.unchecked_transaction()?;
                tx.execute(
                    "UPDATE subtasks SET status = ?1 WHERE status IN (?2, ?3) \
                     AND delegation_id IN (SELECT id FROM delegations WHERE status IN (?4, ?5))",
                    params![
                        SubtaskStatus::Cancelled.as_str(),
                        SubtaskStatus::Pending.as_str(),
                        SubtaskStatus::Running.as_str(),
                        running,
                        reporting,
                    ],
                )?;
                let count = tx.execute(
                    "UPDATE delegations SET status = ?1, updated_at = ?2 WHERE status IN (?3, ?4)",
                    params![DelegationStatus::Cancelled.as_str(), now, running, reporting],
                )?;
                tx.commit()?;
                Ok(count)
            })
            .map_err(storage)
    }
}
