//! ランナーが申告するバックエンド（Claude / Codex / 将来の追加分）とランナー自体の状態。Rust では列挙しない。

mod options;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::agent::{PermissionKey, Permissions};

pub use options::sanitize_backend_options;

/// backendOptions の推論の深さのキー（値は、選んだモデルの ModelSpec.efforts のどれか）
pub const EFFORT_OPTION: &str = "effort";

/// バックエンドの状態（認証の有無など）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackendStatus {
    Ready,
    NeedsAuth,
    Stopped,
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

/// 選べるモデル（TS の ModelSpec。id は実行時に渡す値）。efforts は選べる推論の深さ（浅い順。空なら選べない）、
/// default_effort は深さを選ばないときの深さ（None はバックエンドに任せる）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSpec {
    pub id: String,
    pub label: String,
    pub description: String,
    pub efforts: Vec<String>,
    pub default_effort: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools: Option<bool>,
}

/// TS の BackendInfo
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendInfo {
    pub id: String,
    pub label: String,
    /// 選べるモデル（分からなければ空）
    pub models: Vec<ModelSpec>,
    /// モデルを選ばないときに使うモデル（空ならバックエンドに任せる）
    pub default_model: String,
    /// バックエンドがそもそも提供できる能力
    pub capabilities: Permissions,
    pub status: BackendStatus,
    /// status が ready 以外のときの案内
    pub status_message: String,
    pub options: Vec<OptionSpec>,
    /// 守れない権限の組み合わせを防ぐ規則
    pub permission_rules: Vec<PermissionRule>,
    /// どれかの組をすべて許すと、PC のどのファイルでも読めて外へも送れる権限の組（React が編集画面で知らせる。保存は止めない）
    pub leak_risks: Vec<Vec<PermissionKey>>,
    /// アプリからログインを始められる（login_backend）
    pub can_login: bool,
    /// 作業の途中でチャットに投稿する方法（途中では投稿できないなら None）
    pub mid_run_post: Option<MidRunPost>,
}

impl BackendInfo {
    pub fn is_ready(&self) -> bool {
        self.status == BackendStatus::Ready
    }

    /// 実際に使うモデル（空なら既定のモデル）の定義。モデルの一覧に無ければ None
    pub fn model_spec(&self, model: &str) -> Option<&ModelSpec> {
        let id = if model.is_empty() { self.default_model.as_str() } else { model };
        self.models.iter().find(|spec| spec.id == id)
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
        Self { state: RuntimeState::Starting, message: String::new() }
    }
}
