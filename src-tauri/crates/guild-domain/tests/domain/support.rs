//! テスト用のデータ作成。エージェントはテンプレート（"worker" / "expert" / "manager" など）の既定値から作る。

use guild_domain::agent::{find_template, Agent, AgentInput, Permissions};
use guild_domain::author::{Author, MemberId};
use guild_domain::backend::{BackendInfo, BackendStatus};
use guild_domain::channel::Channel;
use guild_domain::ids::{AgentId, ChannelId, MessageId};
use guild_domain::message::{Message, MessageKind};

pub fn input(template: &str, name: &str) -> AgentInput {
    let defaults = find_template(template).unwrap_or_else(|| panic!("テンプレート {template} がありません")).defaults;
    AgentInput {
        name: name.to_owned(),
        avatar: "🙂".to_owned(),
        color: "#5865f2".to_owned(),
        tags: defaults.tags,
        role: format!("{name}の役割"),
        personality: "まじめ".to_owned(),
        tone: "丁寧語".to_owned(),
        expertise: format!("{name}の専門"),
        backend: "claude".to_owned(),
        model: String::new(),
        backend_options: serde_json::Map::new(),
        permissions: defaults.permissions,
        unmentioned: defaults.unmentioned,
        consultable: defaults.consultable,
        can_delegate: defaults.can_delegate,
        autonomy_enabled: defaults.autonomy_enabled,
        autonomy_interval_min: 60,
        autonomy_channel_id: None,
    }
}

/// created_at は作成順（default_responders の並び）を決める
pub fn agent_at(id: &str, template: &str, name: &str, created_at: i64) -> Agent {
    Agent::new(AgentId::new(id), input(template, name), created_at)
}

pub fn agent(id: &str, template: &str, name: &str) -> Agent {
    agent_at(id, template, name, 0)
}

/// members は "me" かエージェント ID
pub fn channel(id: &str, members: &[&str]) -> Channel {
    Channel {
        workspace: Default::default(),
        is_lobby: false,
        id: ChannelId::new(id),
        name: "ロビー".to_owned(),
        topic: "雑談".to_owned(),
        member_ids: members.iter().map(|m| MemberId::from((*m).to_owned())).collect(),
        created_at: 0,
    }
}

/// id は "m{seq}"、起点は自分、depth 0、メンションなし（必要ならテストで書き換える）
pub fn message(seq: i64, author: Author, content: &str) -> Message {
    let id = MessageId::new(format!("m{seq}"));
    Message {
        id: id.clone(),
        seq,
        channel_id: ChannelId::new("c1"),
        author_id: author,
        content: content.to_owned(),
        attachments: Vec::new(),
        kind: MessageKind::Chat,
        mentions: Vec::new(),
        reply_to_id: None,
        root_id: id,
        depth: 0,
        delegation_id: None,
        created_at: 0,
    }
}

pub fn by(agent_id: &str) -> Author {
    Author::Agent(AgentId::new(agent_id))
}

pub fn ids(values: &[&str]) -> Vec<AgentId> {
    values.iter().map(|v| AgentId::new(*v)).collect()
}

/// すべての権限
pub const ALL: Permissions = Permissions {
    web_search: true,
    web_fetch: true,
    read_files: true,
    read_anywhere: false,
    write_files: true,
    write_anywhere: true,
    run_commands: true,
    skills: true,
};

pub fn backend(id: &str) -> BackendInfo {
    BackendInfo {
        id: id.to_owned(),
        label: id.to_owned(),
        models: Vec::new(),
        default_model: String::new(),
        capabilities: ALL,
        status: BackendStatus::Ready,
        status_message: String::new(),
        options: Vec::new(),
        permission_rules: Vec::new(),
        leak_risks: Vec::new(),
        unrestricted: Vec::new(),
        can_login: false,
        mid_run_post: None,
    }
}
