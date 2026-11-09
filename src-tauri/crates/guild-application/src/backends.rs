//! バックエンドの状態の確認し直し（refresh_backends）と、アプリからのログイン（login_backend）。
//! 結果はランタイムの状態の変化（state-changed）で届く。

use std::sync::Arc;

use guild_domain::error::ValidationError;

use crate::error::{AppError, AppResult};
use crate::ports::{AgentRuntime, RuntimeError};

#[derive(Clone)]
pub struct BackendService {
    runtime: Arc<dyn AgentRuntime>,
}

impl BackendService {
    pub fn new(runtime: Arc<dyn AgentRuntime>) -> Self {
        Self { runtime }
    }

    pub async fn refresh(&self) {
        self.runtime.probe().await;
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
