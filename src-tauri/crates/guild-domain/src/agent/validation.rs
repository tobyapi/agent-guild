//! エージェント入力の検証と正規化（design.md §2 の入力規則）。名前の重複は name.rs の ensure_unique_name。

use super::name::normalize_name;
use super::tags::normalize_tags;
use super::AgentInput;
use crate::backend::{sanitize_backend_options, BackendInfo};
use crate::error::ValidationError;

/// 自発活動の間隔（分）の下限
pub const AUTONOMY_INTERVAL_MIN: u32 = 5;
/// アバター（data URL を含む）の最大バイト数
pub const AVATAR_MAX_BYTES: usize = 2 * 1024 * 1024;

/// 入力を検証して正規化する。backend は選んだバックエンドの情報（ランナーが未起動で分からなければ None。
/// そのときは backendOptions をそのまま残し、権限の組み合わせ規則は実行時の拒否に任せる）
pub fn normalize_agent_input(
    mut input: AgentInput,
    backend: Option<&BackendInfo>,
) -> Result<AgentInput, ValidationError> {
    input.name = normalize_name(&input.name)?;
    input.tags = normalize_tags(&input.tags)?;
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
        ensure_permission_rules(&input, info)?;
    }
    Ok(input)
}

/// 実効権限（permissions ∧ capabilities）がバックエンドの権限の規則（permissionRules）を満たすこと。違反は field permissions。
/// 足りない権限をバックエンドが提供できるなら許可を促し、できないなら別のバックエンドか、その権限を外すよう促す
fn ensure_permission_rules(input: &AgentInput, info: &BackendInfo) -> Result<(), ValidationError> {
    let effective = input.permissions.intersect(info.capabilities);
    for rule in &info.permission_rules {
        let missing = rule.missing(&effective);
        if missing.is_empty() {
            continue;
        }
        let names = missing.iter().map(|key| format!("「{}」", key.label())).collect::<Vec<_>>().join("と");
        let when = rule.when.label();
        let head = format!("{}で「{when}」を使うには{names}も必要です", info.label);
        let available = missing.iter().all(|key| info.capabilities.get(*key));
        let message = if available {
            format!("{head}。{names}を許可してください")
        } else {
            format!("{head}。{}では{names}を使えないので、「{when}」を外すか別のバックエンドを選んでください", info.label)
        };
        return Err(ValidationError::on("permissions", message));
    }
    Ok(())
}
