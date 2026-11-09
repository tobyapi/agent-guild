//! ランナーが申告するバックエンド（Claude / Codex / 将来の追加分）とランナー自体の状態。Rust では列挙しない。

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::agent::{PermissionKey, Permissions};
use super::error::ValidationError;

/// バックエンドの状態（認証の有無など）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackendStatus {
    Ready,
    NeedsAuth,
    Unavailable,
}

/// バックエンド固有設定の値の型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OptionType {
    String,
    Number,
    Boolean,
    Select,
}

/// バックエンド固有設定の項目定義（TS の OptionSpec）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionSpec {
    pub key: String,
    pub label: String,
    pub description: String,
    #[serde(rename = "type")]
    pub value_type: OptionType,
    /// value_type が select のときの選択肢
    pub choices: Vec<String>,
    /// string | number | boolean | null
    pub default: Value,
}

/// 「when の権限を許すなら、requires の権限もすべて必要」という規則（TS の PermissionRule）。
/// アダプタが守れない権限の組み合わせを申告し、Rust の保存時検証と React の編集画面で使う
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRule {
    pub when: PermissionKey,
    pub requires: Vec<PermissionKey>,
}

impl PermissionRule {
    /// 実効権限がこの規則に反していれば、足りない権限
    pub fn missing(&self, effective: &Permissions) -> Vec<PermissionKey> {
        if !effective.get(self.when) {
            return Vec::new();
        }
        self.requires.iter().copied().filter(|key| !effective.get(*key)).collect()
    }
}

/// 作業の途中でチャットに投稿する方法（TS の MidRunPost）。プロンプトの案内を変える
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MidRunPost {
    /// 投稿用のツール（post）を呼ぶ
    Tool,
    /// ツールを使う前に書いた文章が、そのまま投稿される
    Text,
}

/// TS の BackendInfo
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendInfo {
    pub id: String,
    pub label: String,
    pub model_suggestions: Vec<String>,
    pub default_model: String,
    /// バックエンドがそもそも提供できる能力
    pub capabilities: Permissions,
    pub status: BackendStatus,
    /// status が ready 以外のときの案内
    pub status_message: String,
    pub options: Vec<OptionSpec>,
    /// 守れない権限の組み合わせを防ぐ規則
    pub permission_rules: Vec<PermissionRule>,
    /// アプリからログインを始められる（login_backend）
    pub can_login: bool,
    /// 作業の途中でチャットに投稿する方法（途中では投稿できないなら None）
    pub mid_run_post: Option<MidRunPost>,
}

impl BackendInfo {
    pub fn is_ready(&self) -> bool {
        self.status == BackendStatus::Ready
    }
}

/// backendOptions を項目定義に合わせる: 未知のキーと null（＝既定値）は捨て、型が合わない値は拒否する
pub fn sanitize_backend_options(
    options: Map<String, Value>,
    specs: &[OptionSpec],
) -> Result<Map<String, Value>, ValidationError> {
    let mut result = Map::new();
    for (key, value) in options {
        let Some(spec) = specs.iter().find(|spec| spec.key == key) else {
            continue;
        };
        if value.is_null() {
            continue;
        }
        if !accepts(spec, &value) {
            let message = format!("「{}」の値が正しくありません", spec.label);
            return Err(ValidationError::on("backendOptions", message));
        }
        result.insert(key, value);
    }
    Ok(result)
}

fn accepts(spec: &OptionSpec, value: &Value) -> bool {
    match spec.value_type {
        OptionType::String => value.is_string(),
        OptionType::Number => value.is_number(),
        OptionType::Boolean => value.is_boolean(),
        OptionType::Select => value
            .as_str()
            .is_some_and(|choice| spec.choices.iter().any(|c| c == choice)),
    }
}

/// ランナー自体の状態
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeState {
    Starting,
    Ready,
    Unavailable,
}

/// TS の RuntimeStatus
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RuntimeStatus {
    pub state: RuntimeState,
    pub message: String,
}

impl RuntimeStatus {
    pub fn starting() -> Self {
        Self {
            state: RuntimeState::Starting,
            message: String::new(),
        }
    }
}
