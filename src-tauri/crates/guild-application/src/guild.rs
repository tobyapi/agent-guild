//! ギルドのプロフィール（名前と紋）のユースケース。

use guild_domain::guild::{normalize_guild, GuildProfile};

use crate::error::AppResult;
use crate::services::Ports;

#[derive(Clone)]
pub struct GuildService {
    ports: Ports,
}

impl GuildService {
    pub fn new(ports: Ports) -> Self {
        Self { ports }
    }

    /// 未設定のときは既定のギルドを返す。
    pub fn get(&self) -> AppResult<GuildProfile> {
        load(&self.ports)
    }

    pub fn update(&self, guild: GuildProfile) -> AppResult<GuildProfile> {
        let guild = normalize_guild(guild)?;
        self.ports.guild_state.save_guild(&guild)?;
        self.ports.events.state_changed();
        Ok(guild)
    }
}

/// 保存したギルドのプロフィールを読む（Snapshot の組み立てでも使う）
pub(crate) fn load(ports: &Ports) -> AppResult<GuildProfile> {
    ports.guild_state.guild()
}
