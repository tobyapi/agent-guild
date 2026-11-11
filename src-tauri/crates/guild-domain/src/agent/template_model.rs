//! テンプレートの値の形（TS の AgentTemplate と AgentTemplateDefaults）。表の中身は templates.rs。

use serde::{Deserialize, Serialize};

use super::permissions::Permissions;
use super::UnmentionedPolicy;

/// テンプレートが入れる値（TS の AgentTemplateDefaults）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTemplateDefaults {
    pub tags: Vec<String>,
    /// 担当（Agent.role）の書き出し
    pub role: String,
    /// 得意分野の書き出し（空でもよい）
    pub expertise: String,
    pub permissions: Permissions,
    pub unmentioned: UnmentionedPolicy,
    pub consultable: bool,
    pub can_delegate: bool,
    pub autonomy_enabled: bool,
}

/// TS の AgentTemplate
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTemplate {
    pub id: String,
    pub label: String,
    pub description: String,
    /// 見た目のアクセント。React はトークン `--kind-<accent>` を組み立てるだけ（値で分岐しない）。None なら中立
    pub accent: Option<String>,
    /// 作成・役割変更時に参照として追加する内蔵スキル
    pub builtin_skills: Vec<String>,
    pub defaults: AgentTemplateDefaults,
}
