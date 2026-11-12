//! Tauri コマンド（design.md §3）。すべて async で、引数 → サービス → 失敗は CommandError { code, message, field }。
//! JS の引数は camelCase、Rust の引数は snake_case（Tauri 2 が自動変換）。

pub mod agents;
pub mod boot;
pub mod channels;
pub mod links;
pub mod messages;
pub mod profile;
pub mod skills;
pub mod snapshot;
pub mod storage;
pub mod update;

use guild_application::AppError;
use guild_domain::error::CommandError;

/// コマンドの戻り値
pub type CommandResult<T> = Result<T, CommandError>;

/// ユースケースの失敗をコマンドの失敗にする（ログにも残す）
pub(crate) fn reject(error: AppError) -> CommandError {
    log::warn!("コマンドが失敗しました: {error}");
    error.to_command_error()
}
