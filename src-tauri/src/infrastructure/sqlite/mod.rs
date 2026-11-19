//! SQLite のアダプタ: 接続・スキーマ判定と変換・各リポジトリ。rusqlite はこのフォルダの中だけで使う。

mod agents;
mod channels;
mod codec;
mod convert028;
mod database;
mod delegation_rows;
mod delegations;
mod frames;
mod guild_state;
mod messages;
mod schema;
mod skill_records;
mod skills;
mod statistics;
mod user_profile;

pub use agents::SqliteAgentRepository;
pub use channels::SqliteChannelRepository;
pub use database::{inspect_database, Database, DbError, OpenError};
pub use delegations::SqliteDelegationRepository;
pub use frames::SqliteFrameRepository;
pub use guild_state::SqliteGuildStateRepository;
pub use messages::SqliteMessageRepository;
pub use skill_records::SqliteSkillRecordRepository;
pub use skills::SqliteSkillRepository;
pub use statistics::SqliteStatisticsRepository;
pub use user_profile::SqliteProfileRepository;

#[cfg(test)]
mod tests;
