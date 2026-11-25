//! 会話ジョブの run 要求。

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::{ImagePayload, Permissions, SkillPayload};

/// 1回の実行の依頼（protocol.ts の run から type と id を除いたもの）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequest {
    /// None なら会話ジョブの実行時間に上限を設けない。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeout_minutes: Option<u16>,
    pub backend: String,
    /// エージェントの作業場所（cwd）。書き込みはここだけ
    pub workspace: PathBuf,
    /// アダプタの管理領域（スキルの展開・人格ファイルなど）。エージェントからは書けない
    pub state_dir: PathBuf,
    /// アプリが管理する作業場所を作り、管理領域を実行前に作り直す
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub prepare_workspace: bool,
    /// 追加で読み取りを許すフォルダ（相談元の作業場所など）
    pub readable_dirs: Vec<PathBuf>,
    pub system_prompt: String,
    pub prompt: String,
    /// 操作の確認に使う、信頼できる依頼の情報（使わないアダプタは無視する）
    pub intent: String,
    /// 空文字ならバックエンド既定
    pub model: String,
    pub permissions: Permissions,
    pub skills: Vec<SkillPayload>,
    /// 応える発言と会話の起点に貼られた画像（発言の順）
    pub images: Vec<ImagePayload>,
    /// バックエンド固有の追加設定（Agent.backendOptions の素通し）
    pub options: serde_json::Map<String, serde_json::Value>,
}
