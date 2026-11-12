//! スキルのリポジトリ。(agent_id, name) は一意。source は SkillSource の JSON で、NULL ならアプリ内のスキル（problem は DB に持たない）。

use std::sync::Arc;

use guild_application::ports::SkillRepository;
use guild_application::{AppError, AppResult};
use guild_domain::ids::{AgentId, SkillId};
use guild_domain::skill::{skill_name_taken, Skill, SkillSource};
use rusqlite::types::Type;
use rusqlite::{params, OptionalExtension, Row};

use super::codec::{is_unique_violation, storage, to_json};
use super::database::Database;

const COLUMNS: &str = "id, agent_id, name, description, body, source, updated_at";

pub struct SqliteSkillRepository {
    db: Arc<Database>,
}

impl SqliteSkillRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl SkillRepository for SqliteSkillRepository {
    fn list_for_agent(&self, agent: &AgentId) -> AppResult<Vec<Skill>> {
        let sql = format!("SELECT {COLUMNS} FROM skills WHERE agent_id = ?1 ORDER BY name");
        self.db.with(|conn| conn.prepare(&sql)?.query_map([agent.as_str()], read_skill)?.collect()).map_err(storage)
    }

    fn get(&self, id: &SkillId) -> AppResult<Option<Skill>> {
        let sql = format!("SELECT {COLUMNS} FROM skills WHERE id = ?1");
        self.db.with(|conn| conn.query_row(&sql, [id.as_str()], read_skill).optional()).map_err(storage)
    }

    fn upsert(&self, skill: &Skill) -> AppResult<()> {
        let result = self.db.with(|conn| {
            let source = skill.source.as_ref().map(to_json).transpose()?;
            conn.execute(
                "INSERT INTO skills (id, agent_id, name, description, body, source, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) \
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name, description = excluded.description, \
                 body = excluded.body, source = excluded.source, updated_at = excluded.updated_at",
                params![
                    skill.id.as_str(),
                    skill.agent_id.as_str(),
                    skill.name,
                    skill.description,
                    skill.body,
                    source,
                    skill.updated_at,
                ],
            )
        });
        match result {
            Ok(_) => Ok(()),
            Err(error) if is_unique_violation(&error) => Err(AppError::Conflict(skill_name_taken(&skill.name))),
            Err(error) => Err(storage(error)),
        }
    }

    fn delete(&self, id: &SkillId) -> AppResult<()> {
        self.db
            .with(|conn| conn.execute("DELETE FROM skills WHERE id = ?1", [id.as_str()]))
            .map(|_| ())
            .map_err(storage)
    }

    fn delete_for_agent(&self, agent: &AgentId) -> AppResult<()> {
        self.db
            .with(|conn| conn.execute("DELETE FROM skills WHERE agent_id = ?1", [agent.as_str()]))
            .map(|_| ())
            .map_err(storage)
    }
}

fn read_skill(row: &Row<'_>) -> rusqlite::Result<Skill> {
    Ok(Skill {
        id: SkillId::new(row.get::<_, String>(0)?),
        agent_id: AgentId::new(row.get::<_, String>(1)?),
        name: row.get(2)?,
        description: row.get(3)?,
        body: row.get(4)?,
        source: read_source(row, 5)?,
        problem: None,
        updated_at: row.get(6)?,
    })
}

/// source の列（SkillSource の JSON。NULL ならアプリ内のスキル）
fn read_source(row: &Row<'_>, index: usize) -> rusqlite::Result<Option<SkillSource>> {
    let Some(text) = row.get::<_, Option<String>>(index)? else {
        return Ok(None);
    };
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|error| rusqlite::Error::FromSqlConversionFailure(index, Type::Text, Box::new(error)))
}
