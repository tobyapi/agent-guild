//! エージェント入力の検証と正規化（design.md §2 の入力規則）。名前の重複は name.rs の ensure_unique_name。

use super::name::normalize_name;
use super::tags::normalize_tags;
use super::{role_permissions, supported_permissions, AgentInput};
use crate::backend::{sanitize_backend_options, BackendInfo};
use crate::error::ValidationError;

/// 自発活動の間隔（分）の下限
pub const AUTONOMY_INTERVAL_MIN: u32 = 5;
/// アバター（data URL を含む）の最大バイト数
pub const AVATAR_MAX_BYTES: usize = 2 * 1024 * 1024;

/// 入力を検証して正規化する。backend は選んだバックエンドの情報（ランナーが未起動で分からなければ None。
/// そのときは backendOptions を保ち、役割の権限を実行時にバックエンド情報で絞る）
pub fn normalize_agent_input(
    mut input: AgentInput,
    backend: Option<&BackendInfo>,
) -> Result<AgentInput, ValidationError> {
    input.name = normalize_name(&input.name)?;
    input.tags = normalize_tags(&input.tags)?;
    input.permissions = supported_permissions(role_permissions(&input.tags), backend);
    input.backend = input.backend.trim().to_owned();
    input.model = input.model.trim().to_owned();
    if input.backend.is_empty() {
        return Err(ValidationError::on("backend", "バックエンドを選んでください"));
    }
    if input.autonomy_interval_min < AUTONOMY_INTERVAL_MIN {
        return Err(ValidationError::on("autonomyIntervalMin", "自発活動の間隔は5分以上にしてください"));
    }
    if input.avatar.len() > AVATAR_MAX_BYTES {
        return Err(ValidationError::on("avatar", "アバター画像が大きすぎます（2MB まで）"));
    }
    if let Some(info) = backend {
        input.backend_options = sanitize_backend_options(input.backend_options, info, &input.model)?;
    }
    Ok(input)
}
