//! 初期データ（design.md §13）。meta 表に seeded の記録がないときだけ、ロビーと作業者・歓迎の発言を入れる。
//! 初期データはブラウザーのモックと共有する。

use std::error::Error;

use crate::infrastructure::sqlite::SqliteGuildStateRepository;
use guild_application::ports::GuildStateRepository;
use guild_domain::agent::{find_template, normalize_agent_input, Agent, AgentInput};
use guild_domain::author::MemberId;
use serde::Deserialize;

const STARTER: &str = include_str!("../../../src/shared/assets/starter.json");
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
    /// 絵文字（画像は同梱しない）
    avatar: String,
    color: String,
    tags: Vec<String>,
    role: String,
    personality: String,
    tone: String,
    backend: String,
    model: String,
}

/// 初回だけ初期データを入れる（ユースケース経由なので入力規則の検証も通る）
pub fn run_once(
    state: &SqliteGuildStateRepository,
    ids: &dyn guild_application::ports::IdGenerator,
    clock: &dyn guild_application::ports::Clock,
) -> Result<(), Box<dyn Error>> {
    use guild_domain::{
        author::Author,
        channel::Channel,
        ids::{AgentId, ChannelId, MessageId},
        message::{MessageKind, NewMessage},
    };
    if state.seeded()? {
        return Ok(());
    }
    let Starter { agent, welcome } = serde_json::from_str(STARTER)?;
    let now = clock.now_ms();
    let agent = Agent::new(AgentId::new(ids.new_id()), normalize_agent_input(agent_input(agent)?, None)?, now);
    let channel = Channel {
        id: ChannelId::new(ids.new_id()),
        workspace: Default::default(),
        name: LOBBY_NAME.into(),
        topic: LOBBY_TOPIC.into(),
        icon: String::new(),
        is_lobby: true,
        created_at: now,
        member_ids: vec![MemberId::Human, MemberId::Agent(agent.id.clone())],
    };
    let id = MessageId::new(ids.new_id());
    let welcome = NewMessage {
        root_id: id.clone(),
        id,
        channel_id: channel.id.clone(),
        author_id: Author::System,
        content: welcome,
        skill_usage: None,
        attachments: Vec::new(),
        kind: MessageKind::System,
        mentions: Vec::new(),
        reply_to_id: None,
        depth: 0,
        delegation_id: None,
        created_at: now,
    };
    state.seed(&agent, &channel, &welcome)?;
    Ok(())
}

fn agent_input(seed: SeedAgent) -> Result<AgentInput, String> {
    let defaults = find_template(&seed.template)
        .ok_or_else(|| format!("初期データのテンプレート {} がありません", seed.template))?
        .defaults;
    Ok(AgentInput {
        name: seed.name,
        avatar: seed.avatar,
        color: seed.color,
        frame: String::new(),
        voice: Default::default(),
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
