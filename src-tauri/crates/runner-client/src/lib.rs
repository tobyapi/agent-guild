//! agent-runner（sidecar）を子プロセスとして起動・監視し、stdio の JSON Lines で LLM エージェントの実行を依頼するクライアント。
//! プロトコルの正は `agent-runner/src/protocol.ts`（同梱の内部契約。protocolVersion の完全一致）。実例は `contracts/runner/`。
//!
//! 公開 API（本体クレートの infrastructure/runtime/ が依存する契約）は、このファイルと protocol.rs・error.rs の型、
//! client.rs の `RunnerClient`。内部: supervisor（起動・再起動の監視タスク）/ connection（子プロセス1つ）/
//! reader（stdout・stderr）/ run（1回の実行の流れ）/ jobs（job_id ごとの待ち手）/ wire（JSON の形）/
//! launch（起動コマンド）/ job_object（Windows の孤児対策）/ shared（タスク間で共有する状態）。

mod client;
mod connection;
mod error;
mod job_object;
mod jobs;
mod launch;
mod protocol;
mod reader;
mod run;
mod shared;
mod supervisor;
mod wire;

use std::path::PathBuf;
use std::time::Duration;

pub use client::RunnerClient;
pub use error::{ErrorCode, RunnerError};
pub use protocol::{
    BackendInfo, BackendStatus, ImagePayload, MidRunPost, ModelSpec, OptionKind, OptionSpec, PermissionKey,
    PermissionRule, Permissions, RunRequest, RunUsage, SkillPayload,
};

/// プロトコルの版。ランナーの `ready.protocolVersion` と完全に一致しなければ、そのランナーは使わない。
pub const PROTOCOL_VERSION: u32 = 1;

/// ランナーの起動方法。開発中は Node でスクリプトを直接、配布時は Tauri sidecar として同梱した単一バイナリ。
#[derive(Debug, Clone)]
pub enum Launch {
    Node { node: PathBuf, script: PathBuf },
    Binary { path: PathBuf },
}

#[derive(Debug, Clone)]
pub struct RunnerConfig {
    pub launch: Launch,
    /// ランナーに渡す追加の引数（Node ならスクリプトの後ろ）
    pub args: Vec<String>,
    /// 子プロセスに足す環境変数（親の環境は引き継ぐ）
    pub env: Vec<(String, String)>,
    /// 子プロセスの作業ディレクトリ（None なら親と同じ）
    pub cwd: Option<PathBuf>,
    /// 起動から `ready` までを待つ上限
    pub ready_timeout: Duration,
    /// cancel 後に終端イベントを待つ上限。過ぎたら `Err(Cancelled)` を返し、以後その id のイベントは捨てる
    pub cancel_grace: Duration,
}

/// ランナー（子プロセス）の状態。監視タスクが起動・再起動して更新する。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RunnerStatus {
    /// 起動して `ready` を待っている
    Starting,
    Ready,
    /// 使えない（起動失敗・版の不一致・異常終了後の再起動待ち・停止済み）。理由は日本語
    Unavailable {
        message: String,
    },
}

/// 実行中（終端イベントより前）に届く知らせ
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RunUpdate {
    /// 途中経過（「Web検索: …」など）
    Activity(String),
    /// 作業の途中の投稿（チャットに出す文章）
    Post(String),
    Usage(RunUsage),
}

/// 実行中の知らせ（途中経過・途中の投稿）を受け取るコールバック。cancel 後は呼ばれない
pub type UpdateFn = Box<dyn Fn(RunUpdate) + Send + Sync + 'static>;
