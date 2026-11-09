//! スキルのリポジトリ。(agent_id, name) は一意。source_path が NULL でなければ linked（problem は DB に持たない）。

use std::sync::Arc;

use guild_application::ports::SkillRepository;
use guild_application::{AppError, AppResult};
use guild_domain::ids::{AgentId, SkillId};
use guild_domain::skill::{Skill, SkillSource};
use rusqlite::{params, OptionalExtension, Row};

use super::codec::{is_unique_violation, storage};
use super::database::Database;

const COLUMNS: &str = "id, agent_id, name, description, body, source_path, updated_at";

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
        self.db
            .with(|conn| conn.prepare(&sql)?.query_map([agent.as_str()], read_skill)?.collect())
            .map_err(storage)
    }

    fn get(&self, id: &SkillId) -> AppResult<Option<Skill>> {
        let sql = format!("SELECT {COLUMNS} FROM skills WHERE id = ?1");
        self.db
            .with(|conn| conn.query_row(&sql, [id.as_str()], read_skill).optional())
            .map_err(storage)
    }

    fn upsert(&self, skill: &Skill) -> AppResult<()> {
        let result = self.db.with(|conn| {
            conn.execute(
                "INSERT INTO skills (id, agent_id, name, description, body, source_path, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) \
                 ON CONFLICT (id) DO UPDATE SET name = excluded.name, description = excluded.description, \
                 body = excluded.body, source_path = excluded.source_path, updated_at = excluded.updated_at",
                params![
                    skill.id.as_str(),
                    skill.agent_id.as_str(),
                    skill.name,
                    skill.description,
                    skill.body,
                    skill.linked_path(),
                    skill.updated_at,
                ],
            )
        });
        match result {
            Ok(_) => Ok(()),
            Err(error) if is_unique_violation(&error) => Err(AppError::Conflict(format!(
                "「{}」という名前のスキルはすでにあります",
                skill.name
            ))),
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
        source: row.get::<_, Option<String>>(5)?.map(|path| SkillSource::Linked { path }),
        problem: None,
        updated_at: row.get(6)?,
    })
}
