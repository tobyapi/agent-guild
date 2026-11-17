//! Creation from a committed reply; actor identity comes only from the executor.
use crate::{services::Ports, skills::SkillService, AppError, AppResult};
use guild_domain::agent::{creation::CreationRequest, normalize_agent_input, role_can_create_agents, Agent};
use guild_domain::author::Author;
use guild_domain::ids::AgentId;
use guild_domain::message::Message;

pub(crate) fn submit(ports: &Ports, actor: &AgentId, message: &Message, json: &str) -> AppResult<Agent> {
    let result = create(ports, actor, message, json);
    // Never log the payload, model output, parser error, personality, or backend configuration.
    let reason = result.as_ref().err().map_or("accepted", rejection_reason);
    let claims = identity_claims(json);
    log::warn!("agent_creation actor={} message={} reason={} claims={}", actor, message.id, reason, claims);
    if let Err(error) = ports.agents.record_creation_attempt(actor, &message.id, reason, &claims, ports.clock.now_ms())
    {
        log::warn!("agent_creation audit write failed: {:?}", error.code());
    }
    result
}

pub(crate) fn rejection_reason(error: &AppError) -> &'static str {
    match error {
        AppError::Validation(error) => match error.to_string().as_str() {
            "manager_required" => "manager_required",
            "unknown_principal" => "unknown_principal",
            "invalid_source" => "invalid_source",
            "missing_run" => "missing_run",
            "request_too_large" => "request_too_large",
            "invalid_request" => "invalid_request",
            "invalid_request_id" => "invalid_request_id",
            "invalid_template" => "invalid_template",
            "unknown_backend" => "unknown_backend",
            "unknown_model" => "unknown_model",
            _ => "invalid_input",
        },
        _ => "storage_failed",
    }
}

fn create(ports: &Ports, actor: &AgentId, message: &Message, json: &str) -> AppResult<Agent> {
    let principal =
        ports.agents.get(actor)?.filter(Agent::is_active).ok_or_else(|| AppError::validation("unknown_principal"))?;
    if !role_can_create_agents(&principal.tags) {
        return Err(AppError::validation("manager_required"));
    }
    if message.author_id != Author::Agent(actor.clone()) {
        return Err(AppError::validation("invalid_source"));
    }
    let run_id = message
        .skill_usage
        .as_ref()
        .and_then(|u| u.run_id.as_deref())
        .filter(|id| !id.is_empty())
        .ok_or_else(|| AppError::validation("missing_run"))?;
    if json.len() > 8192 {
        return Err(AppError::validation("request_too_large"));
    }
    let request: CreationRequest = serde_json::from_str(json).map_err(|_| AppError::validation("invalid_request"))?;
    let request_id = request.request_id.clone();
    let input = request.input().map_err(AppError::validation)?;
    let backends = ports.runtime.backends();
    let backend =
        backends.iter().find(|b| b.id == input.backend).ok_or_else(|| AppError::validation("unknown_backend"))?;
    if !input.model.is_empty() && backend.model_spec(&input.model).is_none() {
        return Err(AppError::validation("unknown_model"));
    }
    let input = normalize_agent_input(input, Some(backend))?;
    let candidate = Agent::new(AgentId::new(ports.ids.new_id()), input, ports.clock.now_ms());
    let skills = SkillService::new(ports.clone()).prepare_role_defaults(&candidate)?;
    let channels = ports
        .channels
        .list()?
        .into_iter()
        .filter(|c| c.is_lobby || c.id == message.channel_id)
        .map(|c| c.id)
        .collect::<Vec<_>>();
    let registration = crate::ports::AgentRegistration { agent: &candidate, skills: &skills, channels: &channels };
    let agent = ports.agents.insert_from_agent(actor, run_id, &message.id, &request_id, &registration)?;
    ports.events.skills_changed(&agent.id);
    ports.events.state_changed();
    Ok(agent)
}

fn identity_claims(json: &str) -> String {
    if json.len() > 8192 {
        return "oversized".into();
    }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(json) else {
        return "invalid_json".into();
    };
    ["actorId", "agentId", "principalId", "authorId", "createdBy", "role", "permissions"]
        .into_iter()
        .filter_map(|key| {
            value.get(key).map(|value| {
                let safe = value
                    .as_str()
                    .filter(|s| s.len() <= 80 && s.bytes().all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c)));
                format!("{key}={}", safe.unwrap_or("redacted"))
            })
        })
        .collect::<Vec<_>>()
        .join(",")
}
