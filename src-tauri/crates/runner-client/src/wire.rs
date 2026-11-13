//! プロトコルの JSON の形（`agent-runner/src/protocol.ts` と対応。実例は `contracts/runner/`）。
//! 受信は寛容に読む: 未知の type・未知のフィールドは無視し、未知のエラーコードは `Internal` に寄せる。

use serde::{Deserialize, Serialize};

use crate::{BackendInfo, ErrorCode, ImageRequest, RunRequest, RunUsage, RunnerError};

/// Rust → runner
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum Request<'a> {
    Run {
        id: &'a str,
        #[serde(flatten)]
        request: &'a RunRequest,
    },
    /// 画像を1枚描く（終わると text が空の result）
    Image {
        id: &'a str,
        #[serde(flatten)]
        request: &'a ImageRequest,
    },
    Login {
        id: &'a str,
        backend: &'a str,
    },
    Cancel {
        id: &'a str,
    },
    ApiKey {
        id: &'a str,
        backend: &'a str,
        action: &'a str,
        #[serde(skip_serializing_if = "Option::is_none")]
        key: Option<&'a str>,
    },
    BackendAuthMode { id: &'a str, backend: &'a str, mode: &'a str },
    Probe {
        id: &'a str,
    },
    /// 言語が変わった（返事はない。ランナーは backends を送り直す）
    SetLanguage {
        language: &'a str,
    },
    Shutdown,
}

impl Request<'_> {
    /// 改行つきの1行にする（serde_json は文字列中の改行をエスケープするので必ず1行に収まる）
    pub(crate) fn to_line(&self) -> Result<String, RunnerError> {
        let mut line = serde_json::to_string(self)
            .map_err(|error| RunnerError::Protocol(format!("要求を JSON にできません: {error}")))?;
        line.push('\n');
        Ok(line)
    }
}

/// runner → Rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) enum Event {
    Ready(Ready),
    Backends {
        backends: Vec<BackendInfo>,
    },
    Activity {
        id: String,
        detail: String,
    },
    /// 作業の途中の投稿
    Post {
        id: String,
        text: String,
    },
    Usage {
        id: String,
        usage: RunUsage,
    },
    Result {
        id: String,
        text: String,
    },
    Error {
        id: Option<String>,
        code: String,
        message: String,
    },
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Ready {
    pub protocol_version: u32,
    #[serde(default)]
    pub runner_version: String,
    /// 版を確かめてから読む（版が違えば形も違いうるので、ここでは解釈しない）
    #[serde(default)]
    pub backends: serde_json::Value,
}

pub(crate) fn parse_event(line: &str) -> Result<Event, serde_json::Error> {
    serde_json::from_str(line)
}

/// ランナーの error イベントを `RunnerError` にする（cancelled は中断として扱う）
pub(crate) fn runner_error(code: &str, message: String) -> RunnerError {
    let code = match code {
        "cancelled" => return RunnerError::Cancelled,
        "auth" => ErrorCode::Auth,
        "rate_limit" => ErrorCode::RateLimit,
        "model_not_found" => ErrorCode::ModelNotFound,
        "unknown_backend" => ErrorCode::UnknownBackend,
        "unsupported_permission" => ErrorCode::UnsupportedPermission,
        "bad_request" => ErrorCode::BadRequest,
        _ => ErrorCode::Internal,
    };
    RunnerError::Backend { code, message }
}

#[cfg(test)]
mod tests;
