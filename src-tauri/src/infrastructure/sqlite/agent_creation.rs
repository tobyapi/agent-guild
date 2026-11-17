use super::{
    agents::{insert_agent, read_agent, COLUMNS},
    codec::storage,
    Database,
};
use guild_application::{AppError, AppResult};
use guild_domain::agent::{name_key, role_can_create_agents, role_template, Agent};
use guild_domain::ids::{AgentId, MessageId};
use guild_domain::profile::Profile;
use rusqlite::{params, OptionalExtension};

pub(super) fn insert(
    db: &Database,
    actor: &AgentId,
    run_id: &str,
    message_id: &MessageId,
    request_id: &str,
    registration: &guild_application::ports::AgentRegistration<'_>,
) -> AppResult<Agent> {
    let agent = registration.agent;
    db.with(|conn| {
        let tx = conn.unchecked_transaction()?;
        let sql = format!("SELECT {COLUMNS} FROM agents WHERE id = ?1");
        let principal = tx.query_row(&sql, [actor.as_str()], read_agent).optional()?;
        if !principal.is_some_and(|a| a.is_active() && role_can_create_agents(&a.tags)) {
            return Ok(Err(AppError::validation("manager_required")));
        }
        if role_template(&agent.tags).is_none() || role_can_create_agents(&agent.tags) {
            return Ok(Err(AppError::validation("invalid_template")));
        }
        let source: Option<(String, String, String)> = tx.query_row(
            "SELECT author_id, kind, skill_usage FROM messages WHERE id = ?1", [message_id.as_str()],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))).optional()?;
        let valid_source = source.is_some_and(|(author, kind, usage)| {
            author == actor.as_str() && (kind == "chat" || kind == "autonomous") &&
            serde_json::from_str::<guild_domain::skill_usage::SkillUsage>(&usage).ok()
                .is_some_and(|u| u.run_id.as_deref() == Some(run_id) && !run_id.is_empty())
        });
        if !valid_source { return Ok(Err(AppError::validation("invalid_source"))); }
        let previous: Option<String> = tx.query_row(
            "SELECT agent_id FROM agent_creation_receipts WHERE (created_by = ?1 AND request_id = ?2) OR message_id = ?3",
            params![actor.as_str(), request_id, message_id.as_str()], |row| row.get(0)).optional()?;
        if let Some(id) = previous {
            return tx.query_row(&sql, [id], read_agent).map(Ok);
        }
        let human: Option<String> = tx.query_row("SELECT name FROM profile WHERE id = 1", [], |row| row.get(0)).optional()?;
        if name_key(&human.unwrap_or_else(|| Profile::default().name)) == name_key(&agent.name) {
            return Ok(Err(AppError::validation("name_taken")));
        }
        insert_agent(&tx, agent)?;
        for skill in registration.skills { super::skills::upsert_skill(&tx, skill)?; }
        for channel in registration.channels {
            super::channels::add(&tx, channel, &guild_domain::author::MemberId::Agent(agent.id.clone()))?;
        }
        tx.execute("INSERT INTO agent_creation_receipts (created_by, request_id, run_id, message_id, agent_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![actor.as_str(), request_id, run_id, message_id.as_str(), agent.id.as_str(), agent.created_at])?;
        tx.commit()?;
        Ok(Ok(agent.clone()))
    }).map_err(storage)?
}
