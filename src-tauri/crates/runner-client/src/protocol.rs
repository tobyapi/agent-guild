//! プロトコルでやりとりする値の型（`agent-runner/src/protocol.ts` と同じ JSON。camelCase）。

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// 権限は「その効果を許すか」。false の効果を確実に防げないアダプタは実行を拒否する（`UnsupportedPermission`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    pub web_search: bool,
    pub web_fetch: bool,
    pub read_files: bool,
    pub write_files: bool,
    pub write_anywhere: bool,
    pub run_commands: bool,
    pub skills: bool,
}

/// 権限の名前（Permissions のキー）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionKey {
    WebSearch,
    WebFetch,
    ReadFiles,
    WriteFiles,
    WriteAnywhere,
    RunCommands,
    Skills,
}

/// 「when を許すなら requires もすべて必要」。アダプタが守れない権限の組み合わせを申告する
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRule {
    pub when: PermissionKey,
    pub requires: Vec<PermissionKey>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackendStatus {
    Ready,
    NeedsAuth,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OptionKind {
    String,
    Number,
    Boolean,
    Select,
}

/// バックエンド固有設定（Agent.backendOptions）の1項目の定義
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionSpec {
    pub key: String,
    pub label: String,
    pub description: String,
    #[serde(rename = "type")]
    pub kind: OptionKind,
    pub choices: Vec<String>,
    /// 文字列・数値・真偽値・null のどれか
    pub default: serde_json::Value,
}

/// 作業の途中でチャットに投稿する方法
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MidRunPost {
    /// 投稿用のツール（post）を呼ぶ
    Tool,
    /// ツールを使う前に書いた文章が、そのまま投稿される
    Text,
}

/// 選べるモデル（id は run の model に渡す値）。efforts は選べる推論の深さ（浅い順。空なら選べない）、
/// default_effort は深さを選ばないときの深さ（None はバックエンドに任せる）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSpec {
    pub id: String,
    pub label: String,
    pub description: String,
    pub efforts: Vec<String>,
    pub default_effort: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendInfo {
    pub id: String,
    pub label: String,
    /// 選べるモデル（分からなければ空）
    pub models: Vec<ModelSpec>,
    /// モデルを選ばないときに使うモデル（空ならバックエンドに任せる）
    pub default_model: String,
    /// そもそも提供できる能力
    pub capabilities: Permissions,
    pub status: BackendStatus,
    pub status_message: String,
    pub options: Vec<OptionSpec>,
    /// 守れない権限の組み合わせ（Rust の保存時検証と React の編集画面で使う）
    pub permission_rules: Vec<PermissionRule>,
    /// どれかの組をすべて許すと、PC のどのファイルでも読めて外へも送れる権限の組（React が編集画面で知らせる）
    pub leak_risks: Vec<Vec<PermissionKey>>,
    /// アプリからログインを始められる（login 要求を受け付ける）
    pub can_login: bool,
    /// 作業の途中でチャットに投稿する方法（途中では投稿できないなら None）
    #[serde(default)]
    pub mid_run_post: Option<MidRunPost>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillPayload {
    pub name: String,
    pub description: String,
    pub body: String,
    /// linked のスキルの参照先（付属ファイルをアダプタがコピーする）。None でも必ず `"dir": null` を送る
    pub dir: Option<PathBuf>,
}

/// run に添える画像（会話に貼られたもの）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagePayload {
    /// 画像ファイルの絶対パス（データフォルダの attachments/ の中）
    pub path: PathBuf,
    /// image/png・image/jpeg・image/gif・image/webp のどれか
    pub media_type: String,
}

/// 1回の実行の依頼（protocol.ts の run から type と id を除いたもの）
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequest {
    pub backend: String,
    /// エージェントの作業場所（cwd）。書き込みはここだけ
    pub workspace: PathBuf,
    /// アダプタの管理領域（スキルの展開・人格ファイルなど）。エージェントからは書けない
    pub state_dir: PathBuf,
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
