//! ギルドのプロフィール（名前と紋）のユースケース。DB の meta 表に JSON で保存する（マイグレーションは不要）。

use guild_domain::guild::{normalize_guild, read_stored_guild, GuildProfile};

use crate::error::{AppError, AppResult};
use crate::services::Ports;

/// meta 表のキー
pub const GUILD_KEY: &str = "guild_profile";

#[derive(Clone)]
pub struct GuildService {
    ports: Ports,
}

impl GuildService {
    pub fn new(ports: Ports) -> Self {
        Self { ports }
    }

    /// 未保存・読めない保存値は既定（読めない項目だけ既定にする）
    pub fn get(&self) -> AppResult<GuildProfile> {
        load(&self.ports)
    }

    pub fn update(&self, guild: GuildProfile) -> AppResult<GuildProfile> {
        let guild = normalize_guild(guild)?;
        let json = serde_json::to_string(&guild).map_err(|e| AppError::Internal(e.to_string()))?;
        self.ports.meta.set(GUILD_KEY, &json)?;
        self.ports.events.state_changed();
        Ok(guild)
    }
}

/// 保存したギルドのプロフィールを読む（Snapshot の組み立てでも使う）
pub(crate) fn load(ports: &Ports) -> AppResult<GuildProfile> {
    Ok(read_stored_guild(ports.meta.get(GUILD_KEY)?.as_deref()))
}
