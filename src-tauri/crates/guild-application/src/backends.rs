//! バックエンドの状態の確認し直し（refresh_backends）と、アプリからのログイン（login_backend）。
//! 結果はランタイムの状態の変化（state-changed）で届く。

use std::sync::Arc;

use guild_domain::backend::BackendStatus;
use guild_domain::error::ValidationError;

use crate::error::{AppError, AppResult};
use crate::ports::{AgentRuntime, RuntimeError};

#[cfg(test)]
mod tests;

#[derive(Clone)]
pub struct BackendService {
    runtime: Arc<dyn AgentRuntime>,
}

impl BackendService {
    pub fn new(runtime: Arc<dyn AgentRuntime>) -> Self {
        Self { runtime }
    }

    pub async fn api_key(&self, backend: &str, action: &str, key: Option<&str>) -> AppResult<String> {
        if !matches!(backend, "grok" | "muse") || !matches!(action, "status" | "set" | "delete") {
            return Err(AppError::Validation(ValidationError::new("APIキー設定の対象・操作が不正です")));
        }
        if action == "set"
            && key
                .is_none_or(|value| value.trim().is_empty() || value.len() > 2560 || value.contains(['\r', '\n', '\0']))
        {
            return Err(AppError::Validation(ValidationError::new("APIキーを1行・2560バイト以内で入力してください")));
        }
        let key = if action == "set" { key } else { None };
        self.runtime.api_key(backend, action, key).await.map_err(|_| {
            AppError::Runtime(
                "APIキー設定を処理できませんでした。OSの資格情報ストアと実行環境を確認してください".to_owned(),
            )
        })
    }

    pub async fn refresh(&self) -> AppResult<()> {
        self.runtime.probe().await.map_err(|error| AppError::Runtime(error.to_string()))
    }

    pub async fn install_cli(&self, backend_id: &str) -> AppResult<()> {
        let label = match backend_id {
            "claude" => "Claude Code",
            "codex" => "Codex",
            _ => return Err(AppError::validation("セットアップの対象が不正です")),
        };
        if self.is_available(backend_id) {
            return Ok(());
        }
        self.runtime.install_cli(backend_id).await.map_err(|error| AppError::Runtime(error.to_string()))?;
        self.refresh().await?;
        if self.is_available(backend_id) {
            Ok(())
        } else {
            Err(AppError::Runtime(format!("インストールした {label} を確認できませんでした。再確認をお試しください。")))
        }
    }

    fn is_available(&self, backend_id: &str) -> bool {
        self.runtime
            .backends()
            .iter()
            .any(|backend| backend.id == backend_id && backend.status != BackendStatus::Unavailable)
    }

    /// ログインを始め、利用者が終える（窓が閉じる）まで待つ。ログインできなければ runtime エラー
    pub async fn login(&self, backend_id: &str) -> AppResult<()> {
        let backend = self
            .runtime
            .backends()
            .into_iter()
            .find(|backend| backend.id == backend_id)
            .ok_or(AppError::NotFound("バックエンド"))?;
        if !backend.can_login {
            let message = format!("{} はアプリからログインできません", backend.label);
            return Err(AppError::Validation(ValidationError::new(message)));
        }
        self.runtime.login(backend_id).await.map_err(|error| match error {
            RuntimeError::Cancelled => AppError::Runtime("ログインを中断しました".to_owned()),
            RuntimeError::Failed(message) => AppError::Runtime(message),
        })
    }
}
