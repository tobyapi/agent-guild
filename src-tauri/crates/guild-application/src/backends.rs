//! バックエンドの状態の確認し直し（refresh_backends）と、アプリからのセットアップ（インストール・起動・ログイン・API キー）。
//! どのバックエンドで何ができるかは、アダプタの申告（BackendInfo.setup）だけで決める。結果はランタイムの状態の変化
//! （state-changed）で届く。

use std::sync::Arc;
use std::time::Duration;

use guild_domain::backend::{BackendInfo, BackendStatus};
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

    /// 申告されているバックエンド（ランナーが ready でなければ見つからない）
    fn find(&self, backend_id: &str) -> AppResult<BackendInfo> {
        let found = self.runtime.backends().into_iter().find(|backend| backend.id == backend_id);
        found.ok_or(AppError::NotFound("バックエンド"))
    }

    pub async fn api_key(&self, backend: &str, action: &str, key: Option<&str>) -> AppResult<String> {
        let supported = self.find(backend).is_ok_and(|info| info.setup.api_key.is_some());
        if !supported || !matches!(action, "status" | "set" | "delete") {
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

    /// 止まっているバックエンドのアプリを開き、使えるようになる（か、使えないと分かる）まで待つ
    pub async fn start(&self, backend_id: &str) -> AppResult<()> {
        let backend = self.find(backend_id)?;
        let Some(spec) = backend.setup.start else {
            return Err(AppError::validation(format!("{} はアプリから起動できません", backend.label)));
        };
        if backend.status == BackendStatus::Ready {
            return Ok(());
        }
        self.runtime.start(&backend.label, &spec).await.map_err(|error| AppError::Runtime(error.to_string()))?;
        let settled = async {
            loop {
                self.refresh().await?;
                if matches!(self.find(backend_id)?.status, BackendStatus::Ready | BackendStatus::Unavailable) {
                    return Ok(());
                }
                tokio::time::sleep(Duration::from_millis(400)).await;
            }
        };
        tokio::time::timeout(Duration::from_secs(20), settled).await.map_err(|_| {
            AppError::Runtime(format!(
                "{0} の起動を確認できませんでした。{0} の画面を確認して「再確認」を押してください。",
                backend.label
            ))
        })?
    }

    /// 使えないバックエンドの CLI を、公式のインストーラーで入れる
    pub async fn install_cli(&self, backend_id: &str) -> AppResult<()> {
        let Some(guide) = self.find(backend_id).ok().and_then(|backend| backend.setup.install) else {
            return Err(AppError::validation("セットアップの対象が不正です"));
        };
        if self.is_available(backend_id) {
            return Ok(());
        }
        self.runtime.install_cli(&guide).await.map_err(|error| AppError::Runtime(error.to_string()))?;
        self.refresh().await?;
        if self.is_available(backend_id) {
            Ok(())
        } else {
            let cli = guide.cli;
            Err(AppError::Runtime(format!("インストールした {cli} を確認できませんでした。再確認をお試しください。")))
        }
    }

    fn is_available(&self, backend_id: &str) -> bool {
        self.runtime.backends().iter().any(|backend| {
            backend.id == backend_id && matches!(backend.status, BackendStatus::Ready | BackendStatus::NeedsAuth)
        })
    }

    /// ログインを始め、利用者が終える（窓が閉じる）まで待つ。ログインできなければ runtime エラー
    pub async fn login(&self, backend_id: &str) -> AppResult<()> {
        let backend = self.find(backend_id)?;
        if backend.setup.login.is_none() {
            let message = format!("{} はアプリからログインできません", backend.label);
            return Err(AppError::Validation(ValidationError::new(message)));
        }
        self.runtime.login(backend_id).await.map_err(|error| match error {
            RuntimeError::Cancelled => AppError::Runtime("ログインを中断しました".to_owned()),
            RuntimeError::Failed(message) => AppError::Runtime(message),
        })
    }
}
