//! SQLite アダプタのテスト（メモリ上の DB と一時ファイル）。

mod channels_messages;
mod delegations;
mod opening;
mod records;
mod skill_source;
mod statistics;

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use guild_application::ports::AgentRepository;
use guild_domain::agent::{find_template, Agent, AgentInput};
use guild_domain::ids::AgentId;

use super::{Database, SqliteAgentRepository};

pub(super) fn memory() -> Arc<Database> {
    Arc::new(Database::open_in_memory().unwrap_or_else(|e| panic!("{e}")))
}

/// 一意な一時フォルダ（テストの最後に消す）
pub(super) fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("guild-test-{name}-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap_or_else(|e| panic!("{e}"));
    dir
}

pub(super) fn input(template: &str, name: &str) -> AgentInput {
    let defaults = find_template(template).unwrap().defaults;
    AgentInput {
        name: name.to_owned(),
        tags: defaults.tags,
        avatar: "🌱".to_owned(),
        color: "#cb9d2a".to_owned(),
        role: "リサーチ".to_owned(),
        personality: "好奇心旺盛".to_owned(),
        tone: "丁寧語".to_owned(),
        expertise: String::new(),
        backend: "claude".to_owned(),
        model: "sonnet".to_owned(),
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

/// エージェントを保存して返す
pub(super) fn saved_agent(db: &Arc<Database>, id: &str, name: &str, created_at: i64) -> Agent {
    let agent = Agent::new(AgentId::new(id), input("worker", name), created_at);
    let repository = SqliteAgentRepository::new(db.clone());
    repository.insert(&agent).unwrap_or_else(|e| panic!("{e}"));
    agent
}
