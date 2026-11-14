//! エージェントを実行するランタイム（実装は runner-client 経由の agent-runner sidecar）。

use std::path::PathBuf;

use async_trait::async_trait;
use guild_domain::agent::Permissions;
use guild_domain::backend::{BackendInfo, InstallGuide, RuntimeStatus, StartSpec};
use guild_domain::locale::Language;
use guild_domain::statistics::RunUsage;
use serde_json::{Map, Value};

/// ランナーに渡すスキル（SDK ごとの置き場所への展開はランナーのアダプタの責務）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillPayload {
    pub name: String,
    pub description: String,
    pub body: String,
    /// linked のスキルの参照先（付属ファイルをアダプタがコピーする）。アプリ内のスキルは None
    pub dir: Option<PathBuf>,
    /// 内蔵スキルの付属ファイル（アダプタがスキルのフォルダへ書き出す）。ほかのスキルは空
    pub files: Vec<SkillFilePayload>,
}

/// ランナーに渡すスキルの付属ファイル（中身ごと渡す）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillFilePayload {
    /// スキルのフォルダからの相対パス（/ 区切り）
    pub path: String,
    /// UTF-8 のテキスト
    pub content: String,
}

/// ランナーに渡す画像（会話に貼られたもの）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImagePayload {
    /// 画像ファイルの絶対パス（データフォルダの attachments/ の中）
    pub path: PathBuf,
    pub media_type: String,
}

/// 1回の実行の依頼（protocol.ts の run）
#[derive(Debug, Clone, PartialEq)]
pub struct RuntimeRequest {
    pub backend: String,
    /// 作業場所（cwd）。書き込みはここだけ
    pub workspace: PathBuf,
    /// ランナーのアダプタの管理領域
    pub state_dir: PathBuf,
    /// 追加で読み取りを許すフォルダ（相談元の作業場所など）
    pub readable_dirs: Vec<PathBuf>,
    pub writable_dirs: Option<Vec<PathBuf>>,
    pub system_prompt: String,
    pub prompt: String,
    /// 操作の確認に使う、信頼できる依頼の情報（人間の依頼・エージェントの役割とできること。guild-domain の build_intent）
    pub intent: String,
    /// 空文字ならバックエンド既定
    pub model: String,
    /// 実効権限
    pub permissions: Permissions,
    pub skills: Vec<SkillPayload>,
    /// 応える発言と会話の起点に貼られた画像（発言の順）
    pub images: Vec<ImagePayload>,
    pub options: Map<String, Value>,
}

/// 画像を1枚描く依頼（protocol.ts の image）。権限は持たず、ランナーのアダプタは画像の生成と、スキルの手順に要る道具
/// （作業場所の中だけに書けるコマンド・画像を見る道具）だけを使わせる
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImageRuntimeRequest {
    pub backend: String,
    /// cwd（書き込みはここだけ）
    pub workspace: PathBuf,
    /// ランナーのアダプタの管理領域
    pub state_dir: PathBuf,
    /// 空なら足さない
    pub system_prompt: String,
    pub prompt: String,
    /// 描くときに従うスキル（枠の生成では内蔵スキル ornate-avatar-frame。展開は run と同じくランナーのアダプタ）
    pub skills: Vec<SkillPayload>,
    /// 出来上がった PNG の絶対パス（作業場所の中に置き、プロンプトで保存先として伝える。保存されなければアダプタが書く）
    pub output: PathBuf,
}

/// 実行中（終わる前）に届く知らせ
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RunUpdate {
    /// 途中経過（「Web検索: …」など）
    Activity(String),
    /// 作業の途中の投稿（チャットに出す文章）
    Post(String),
    /// 実際のモデル名や、この実行で取得できた使用量の増分。
    Usage(RunUsage),
}

/// 実行中の知らせ（途中経過・途中の投稿）を受け取る
pub type UpdateSink = Box<dyn Fn(RunUpdate) + Send + Sync>;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum RuntimeError {
    /// 中断された（失敗ではないので error 発言は出さない）
    #[error("実行を中断しました")]
    Cancelled,
    /// 失敗（ランナーが使えない・認証がない・バックエンドのエラーなど）。メッセージは日本語
    #[error("{0}")]
    Failed(String),
}

#[async_trait]
pub trait AgentRuntime: Send + Sync {
    fn status(&self) -> RuntimeStatus;
    /// ランナーが ready でなければ空
    fn backends(&self) -> Vec<BackendInfo>;
    /// 1回実行して最終テキストを返す。途中経過と途中の投稿は on_update に届く。ランナーが使えなければ即座に Failed
    async fn run(&self, job_id: &str, request: RuntimeRequest, on_update: UpdateSink) -> Result<String, RuntimeError>;
    /// 画像を1枚描いてもらう（枠の生成を申告したバックエンドだけ）。成功したら PNG は request.output にある。
    /// 途中経過は on_update に届く。ランナーが使えなければ即座に Failed
    async fn generate_image(
        &self,
        job_id: &str,
        request: ImageRuntimeRequest,
        on_update: UpdateSink,
    ) -> Result<(), RuntimeError>;
    /// 実行中のジョブを中断する（なければ何もしない）
    async fn cancel(&self, job_id: &str);
    /// バックエンドの状態（認証など）を確認し直す。結果は状態の変化として届く
    async fn probe(&self) -> Result<(), RuntimeError>;
    /// 利用者の操作で、バックエンドの CLI を公式のインストーラーで入れる（できない OS では Failed）
    async fn install_cli(&self, guide: &InstallGuide) -> Result<(), RuntimeError>;
    /// 利用者の操作で、止まっているバックエンドのアプリを開く（できない OS では Failed）。label は案内に出す名前
    async fn start(&self, label: &str, spec: &StartSpec) -> Result<(), RuntimeError>;
    /// バックエンドのログインを始め、利用者が終える（窓が閉じる）まで待つ。終わると状態の確認し直しが届く。
    /// ログインできなければ Failed
    async fn login(&self, backend: &str) -> Result<(), RuntimeError>;
    /// API キーの状態を確かめる・保存する・消す。返すのは状態（保存の有無など）だけで、キーそのものは返さない
    async fn api_key(&self, backend: &str, action: &str, key: Option<&str>) -> Result<String, RuntimeError>;
    /// Change Claude/Codex authentication and refresh backend status.
    async fn set_backend_auth_mode(&self, _backend: &str, _mode: &str) -> Result<(), RuntimeError> {
        Ok(())
    }
    /// 表示とエージェントの会話の言語を変える（ランナーが作る文字列の言語。以後の起動にも使う）。
    /// ランナーが使えなくても失敗しない（次の起動で伝わる）。言語を扱わないフェイクは何もしなくてよい
    async fn set_language(&self, _language: Language) {}
}
