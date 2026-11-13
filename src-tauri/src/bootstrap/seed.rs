//! 初期データ（design.md §13）。meta 表に seeded の記録がないときだけ、ロビーと作業者・歓迎の発言を入れる。
//! 初期データと画像はブラウザーのモックと共有する。

use std::error::Error;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use guild_application::ports::MetaRepository;
use guild_application::AppServices;
use guild_domain::agent::{find_template, AgentInput};
use guild_domain::author::MemberId;
use serde::Deserialize;

const SEEDED_KEY: &str = "seeded";
const STARTER: &str = include_str!("../../../src/shared/assets/starter.json");
const AVATAR: &[u8] = include_bytes!("../../../src/shared/assets/starter-avatar.jpg");
const LOBBY_NAME: &str = "ロビー";
const LOBBY_TOPIC: &str = "みんなの雑談と相談の場";

#[derive(Deserialize)]
struct Starter {
    agent: SeedAgent,
    welcome: String,
}

#[derive(Deserialize)]
struct SeedAgent {
    /// 既定値を借りるテンプレートの ID
    template: String,
    name: String,
    color: String,
    tags: Vec<String>,
    role: String,
    personality: String,
    tone: String,
    backend: String,
    model: String,
}

/// 初回だけ初期データを入れる（ユースケース経由なので入力規則の検証も通る）
pub fn run_once(services: &AppServices, meta: &dyn MetaRepository) -> Result<(), Box<dyn Error>> {
    if meta.get(SEEDED_KEY)?.is_some() {
        return Ok(());
    }
    let Starter { agent, welcome } = serde_json::from_str(STARTER)?;
    let agent = services.agents.create(agent_input(agent)?)?;
    let lobby = services.channels.create_lobby(LOBBY_NAME, LOBBY_TOPIC, &[MemberId::Agent(agent.id)])?;
    services.conversation.post_system(&lobby.id, &welcome)?;
    meta.set(SEEDED_KEY, "1")?;
    log::info!("初期データを入れました");
    Ok(())
}

fn agent_input(seed: SeedAgent) -> Result<AgentInput, String> {
    let defaults = find_template(&seed.template)
        .ok_or_else(|| format!("初期データのテンプレート {} がありません", seed.template))?
        .defaults;
    Ok(AgentInput {
        name: seed.name,
        avatar: format!("data:image/jpeg;base64,{}", STANDARD.encode(AVATAR)),
        color: seed.color,
        frame: String::new(),
        tags: seed.tags,
        role: seed.role,
        personality: seed.personality,
        tone: seed.tone,
        expertise: defaults.expertise,
        backend: seed.backend,
        model: seed.model,
        backend_options: serde_json::Map::new(),
        permissions: defaults.permissions,
        unmentioned: defaults.unmentioned,
        consultable: defaults.consultable,
        can_delegate: defaults.can_delegate,
        autonomy_enabled: defaults.autonomy_enabled,
        autonomy_interval_min: 60,
        autonomy_channel_id: None,
    })
}
