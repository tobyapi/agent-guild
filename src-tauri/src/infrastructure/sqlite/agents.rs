//! エージェントのリポジトリ。名前は正規化した name_key で一意（削除されていないものの間で）。

use std::sync::Arc;

use guild_application::ports::AgentRepository;
use guild_application::{AppError, AppResult};
use guild_domain::agent::{name_key, name_taken, role_permissions, Agent, UnmentionedPolicy};
use guild_domain::ids::{AgentId, ChannelId};
use guild_domain::voice::{VoiceIntensity, VoiceSettings};
use rusqlite::{params, Connection, OptionalExtension, Row};

use super::codec::{is_unique_violation, json_column, parsed_column, storage, to_json};
use super::database::{Database, DbError};

const COLUMNS: &str = "id, name, avatar, color, \
    (SELECT json_group_array(label) FROM (SELECT label FROM agent_tags WHERE agent_id=agents.id ORDER BY position)), \
    role_description, personality, tone, expertise, backend, model, backend_options_json, unmentioned, consultable, \
    can_delegate, autonomy_enabled, autonomy_interval_min, autonomy_channel_id, last_autonomous_at, created_at, \
    deleted_at, coalesce(frame_id,''), voice_mode, voice_intensity";

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
        self.db.with(|conn| conn.prepare(&sql)?.query_map([], read_agent)?.collect()).map_err(storage)
    }

    fn get(&self, id: &AgentId) -> AppResult<Option<Agent>> {
        let sql = format!("SELECT {COLUMNS} FROM agents WHERE id = ?1");
        self.db.with(|conn| conn.query_row(&sql, [id.as_str()], read_agent).optional()).map_err(storage)
    }

    fn insert(&self, agent: &Agent) -> AppResult<()> {
        self.db
            .with(|conn| {
                let tx = conn.unchecked_transaction()?;
                insert_agent(&tx, agent)?;
                tx.commit()
            })
            .map_err(name_conflict)
    }

    fn update(&self, agent: &Agent) -> AppResult<()> {
        self.db
            .with(|conn| {
                let tx = conn.unchecked_transaction()?;
                if write_agent(&tx, agent, UPDATE)? > 0 {
                    tx.execute("DELETE FROM agent_tags WHERE agent_id=?1", [agent.id.as_str()])?;
                    write_tags(&tx, agent)?;
                }
                tx.commit()
            })
            .map_err(name_conflict)
    }

    fn mark_deleted(&self, id: &AgentId, deleted_at: i64) -> AppResult<()> {
        self.db
            .with(|conn| {
                conn.execute("UPDATE agents SET deleted_at = ?2 WHERE id = ?1", params![id.as_str(), deleted_at])
            })
            .map(|_| ())
            .map_err(storage)
    }
}

/// 名前の一意索引に当たったら、入力の誤り（validation）として返す
fn name_conflict(error: DbError) -> AppError {
    if is_unique_violation(&error) {
        AppError::Validation(name_taken())
    } else {
        storage(error)
    }
}

pub(super) fn insert_agent(conn: &Connection, agent: &Agent) -> rusqlite::Result<()> {
    write_agent(conn, agent, INSERT)?;
    conn.execute("INSERT INTO actors (id,kind,agent_id) VALUES (?1,'agent',?1)", [agent.id.as_str()])?;
    write_tags(conn, agent)
}

const INSERT: &str = "INSERT INTO agents (id,name,name_key,avatar,color,role_description,personality,tone,expertise,
    backend,model,backend_options_json,unmentioned,consultable,can_delegate,autonomy_enabled,autonomy_interval_min,
    autonomy_channel_id,last_autonomous_at,frame_id,voice_mode,voice_intensity,created_at,deleted_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,nullif(?20,''),?21,?22,?23,?24)";
const UPDATE: &str = "UPDATE agents SET name=?2,name_key=?3,avatar=?4,color=?5,role_description=?6,personality=?7,
    tone=?8,expertise=?9,backend=?10,model=?11,backend_options_json=?12,unmentioned=?13,consultable=?14,
    can_delegate=?15,autonomy_enabled=?16,autonomy_interval_min=?17,autonomy_channel_id=?18,last_autonomous_at=?19,
    frame_id=nullif(?20,''),voice_mode=?21,voice_intensity=?22 WHERE id=?1";

fn write_agent(conn: &Connection, agent: &Agent, sql: &str) -> rusqlite::Result<usize> {
    let intensity = match agent.voice.intensity {
        VoiceIntensity::Weak => "weak",
        VoiceIntensity::Medium => "medium",
        VoiceIntensity::Strong => "strong",
    };
    let fields = params![
        agent.id.as_str(),
        agent.name,
        name_key(&agent.name),
        agent.avatar,
        agent.color,
        agent.role,
        agent.personality,
        agent.tone,
        agent.expertise,
        agent.backend,
        agent.model,
        to_json(&agent.backend_options)?,
        agent.unmentioned.as_str(),
        agent.consultable,
        agent.can_delegate,
        agent.autonomy_enabled,
        agent.autonomy_interval_min,
        agent.autonomy_channel_id.as_ref().map(ChannelId::as_str),
        agent.last_autonomous_at,
        agent.frame,
        agent.voice.mode,
        intensity,
        agent.created_at,
        agent.deleted_at
    ];
    let mut stmt = conn.prepare_cached(sql)?;
    let count = stmt.parameter_count();
    stmt.execute(&fields[..count])
}

fn write_tags(conn: &Connection, agent: &Agent) -> rusqlite::Result<()> {
    let mut add = conn.prepare_cached("INSERT INTO agent_tags (agent_id,position,label) VALUES (?1,?2,?3)")?;
    for (position, label) in (0_i64..).zip(agent.tags.iter()) {
        add.execute(params![agent.id.as_str(), position, label])?;
    }
    Ok(())
}

fn read_agent(row: &Row<'_>) -> rusqlite::Result<Agent> {
    let tags: Vec<String> = json_column(row, 4)?;
    let intensity = parsed_column(row, 23, |v| match v {
        "weak" => Some(VoiceIntensity::Weak),
        "medium" => Some(VoiceIntensity::Medium),
        "strong" => Some(VoiceIntensity::Strong),
        _ => None,
    })?;
    Ok(Agent {
        id: AgentId::new(row.get::<_, String>(0)?),
        name: row.get(1)?,
        avatar: row.get(2)?,
        color: row.get(3)?,
        permissions: role_permissions(&tags),
        tags,
        role: row.get(5)?,
        personality: row.get(6)?,
        tone: row.get(7)?,
        expertise: row.get(8)?,
        backend: row.get(9)?,
        model: row.get(10)?,
        backend_options: json_column(row, 11)?,
        unmentioned: parsed_column(row, 12, UnmentionedPolicy::parse)?,
        consultable: row.get(13)?,
        can_delegate: row.get(14)?,
        autonomy_enabled: row.get(15)?,
        autonomy_interval_min: row.get(16)?,
        autonomy_channel_id: row.get::<_, Option<String>>(17)?.map(ChannelId::new),
        last_autonomous_at: row.get(18)?,
        created_at: row.get(19)?,
        deleted_at: row.get(20)?,
        frame: row.get(21)?,
        voice: VoiceSettings { mode: row.get(22)?, intensity },
    })
}
