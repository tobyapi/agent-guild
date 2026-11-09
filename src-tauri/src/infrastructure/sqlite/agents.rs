//! エージェントのリポジトリ。名前は正規化した name_key で一意（削除されていないものの間で）。

use std::sync::Arc;

use guild_application::ports::AgentRepository;
use guild_application::{AppError, AppResult};
use guild_domain::agent::{name_key, Agent, UnmentionedPolicy};
use guild_domain::error::ValidationError;
use guild_domain::ids::{AgentId, ChannelId};
use rusqlite::{params, OptionalExtension, Row};

use super::codec::{is_unique_violation, json_column, parsed_column, storage, to_json};
use super::database::{Database, DbError};

const COLUMNS: &str = "id, name, avatar, color, tags, role, personality, tone, expertise, backend, model, \
     backend_options, permissions, unmentioned, consultable, can_delegate, autonomy_enabled, \
     autonomy_interval_min, autonomy_channel_id, last_autonomous_at, created_at, deleted_at";

pub struct SqliteAgentRepository {
    db: Arc<Database>,
}

impl SqliteAgentRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl AgentRepository for SqliteAgentRepository {
    fn list(&self) -> AppResult<Vec<Agent>> {
        let sql = format!("SELECT {COLUMNS} FROM agents ORDER BY created_at, rowid");
        self.db
            .with(|conn| conn.prepare(&sql)?.query_map([], read_agent)?.collect())
            .map_err(storage)
    }

    fn get(&self, id: &AgentId) -> AppResult<Option<Agent>> {
        let sql = format!("SELECT {COLUMNS} FROM agents WHERE id = ?1");
        self.db
            .with(|conn| conn.query_row(&sql, [id.as_str()], read_agent).optional())
            .map_err(storage)
    }

    fn insert(&self, agent: &Agent) -> AppResult<()> {
        self.db
            .with(|conn| {
                conn.execute(
                    "INSERT INTO agents (id, name, name_key, avatar, color, tags, role, personality, tone, expertise, \
                     backend, model, backend_options, permissions, unmentioned, consultable, can_delegate, \
                     autonomy_enabled, autonomy_interval_min, autonomy_channel_id, last_autonomous_at, created_at, \
                     deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, \
                     ?18, ?19, ?20, ?21, ?22, ?23)",
                    params![
                        agent.id.as_str(), agent.name, name_key(&agent.name), agent.avatar, agent.color,
                        to_json(&agent.tags)?, agent.role, agent.personality, agent.tone, agent.expertise,
                        agent.backend, agent.model, to_json(&agent.backend_options)?, to_json(&agent.permissions)?,
                        agent.unmentioned.as_str(), agent.consultable, agent.can_delegate, agent.autonomy_enabled,
                        agent.autonomy_interval_min, agent.autonomy_channel_id.as_ref().map(ChannelId::as_str),
                        agent.last_autonomous_at, agent.created_at, agent.deleted_at,
                    ],
                )
            })
            .map(|_| ())
            .map_err(name_conflict)
    }

    fn update(&self, agent: &Agent) -> AppResult<()> {
        self.db
            .with(|conn| {
                conn.execute(
                    "UPDATE agents SET name = ?2, name_key = ?3, avatar = ?4, color = ?5, tags = ?6, role = ?7, \
                     personality = ?8, tone = ?9, expertise = ?10, backend = ?11, model = ?12, backend_options = ?13, \
                     permissions = ?14, unmentioned = ?15, consultable = ?16, can_delegate = ?17, \
                     autonomy_enabled = ?18, autonomy_interval_min = ?19, autonomy_channel_id = ?20, \
                     last_autonomous_at = ?21 WHERE id = ?1",
                    params![
                        agent.id.as_str(), agent.name, name_key(&agent.name), agent.avatar, agent.color,
                        to_json(&agent.tags)?, agent.role, agent.personality, agent.tone, agent.expertise,
                        agent.backend, agent.model, to_json(&agent.backend_options)?, to_json(&agent.permissions)?,
                        agent.unmentioned.as_str(), agent.consultable, agent.can_delegate, agent.autonomy_enabled,
                        agent.autonomy_interval_min, agent.autonomy_channel_id.as_ref().map(ChannelId::as_str),
                        agent.last_autonomous_at,
                    ],
                )
            })
            .map(|_| ())
            .map_err(name_conflict)
    }

    fn mark_deleted(&self, id: &AgentId, deleted_at: i64) -> AppResult<()> {
        self.db
            .with(|conn| conn.execute("UPDATE agents SET deleted_at = ?2 WHERE id = ?1", params![id.as_str(), deleted_at]))
            .map(|_| ())
            .map_err(storage)
    }
}

/// 名前の一意索引に当たったら、入力の誤り（validation）として返す
fn name_conflict(error: DbError) -> AppError {
    if is_unique_violation(&error) {
        AppError::Validation(ValidationError::on("name", "その名前はすでに使われています"))
    } else {
        storage(error)
    }
}

fn read_agent(row: &Row<'_>) -> rusqlite::Result<Agent> {
    Ok(Agent {
        id: AgentId::new(row.get::<_, String>(0)?),
        name: row.get(1)?,
        avatar: row.get(2)?,
        color: row.get(3)?,
        tags: json_column(row, 4)?,
        role: row.get(5)?,
        personality: row.get(6)?,
        tone: row.get(7)?,
        expertise: row.get(8)?,
        backend: row.get(9)?,
        model: row.get(10)?,
        backend_options: json_column(row, 11)?,
        permissions: json_column(row, 12)?,
        unmentioned: parsed_column(row, 13, UnmentionedPolicy::parse)?,
        consultable: row.get(14)?,
        can_delegate: row.get(15)?,
        autonomy_enabled: row.get(16)?,
        autonomy_interval_min: row.get(17)?,
        autonomy_channel_id: row.get::<_, Option<String>>(18)?.map(ChannelId::new),
        last_autonomous_at: row.get(19)?,
        created_at: row.get(20)?,
        deleted_at: row.get(21)?,
    })
}
