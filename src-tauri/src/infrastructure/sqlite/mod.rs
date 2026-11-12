//! SQLite のアダプタ: 接続・マイグレーション・各リポジトリ・meta。rusqlite はこのフォルダの中だけで使う。

mod agents;
mod channels;
mod codec;
mod database;
mod delegation_rows;
mod delegations;
mod frames;
mod messages;
mod migrations;
mod reset;
mod settings_tables;
mod skills;
mod statistics;

pub use agents::SqliteAgentRepository;
pub use channels::SqliteChannelRepository;
pub use database::{inspect_database, Database, DbError, OpenError};
pub use delegations::SqliteDelegationRepository;
pub use frames::SqliteFrameRepository;
pub use messages::SqliteMessageRepository;
pub use settings_tables::{SqliteMetaRepository, SqliteProfileRepository};
pub use skills::SqliteSkillRepository;
pub use statistics::SqliteStatisticsRepository;

#[cfg(test)]
mod tests;
