//! バックエンドの状態の確認し直し（refresh_backends）と、アプリからのセットアップ（インストール・起動・ログイン・API キー）。
//! どのバックエンドで何ができるかは、アダプタの申告（BackendInfo.setup）だけで決める。結果はランタイムの状態の変化
//! （state-changed）で届く。

use std::sync::Arc;
use std::time::Duration;

use guild_domain::backend::{BackendInfo, BackendStatus};
use guild_domain::error::ValidationError;
use guild_domain::locale;

use crate::error::{AppError, AppResult};
use crate::ports::{AgentRuntime, RuntimeError};

mod messages;
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
        found.ok_or(AppError::NotFound(locale::pick(["バックエンド", "Backend", "后端", "後端", "백엔드"])))
    }

    pub async fn api_key(&self, backend: &str, action: &str, key: Option<&str>) -> AppResult<String> {
        let supported = self.find(backend).is_ok_and(|info| info.setup.api_key.is_some());
        if !supported || !matches!(action, "status" | "set" | "delete") {
            return Err(AppError::Validation(ValidationError::new(locale::pick([
                "APIキー設定の対象・操作が不正です",
                "The API key target or operation is invalid",
                "API 密钥设置的对象或操作无效",
                "API 金鑰設定的對象或操作無效",
                "API 키 설정의 대상 또는 작업이 올바르지 않습니다",
            ]))));
        }
        if action == "set"
            && key
                .is_none_or(|value| value.trim().is_empty() || value.len() > 2560 || value.contains(['\r', '\n', '\0']))
        {
            return Err(AppError::Validation(ValidationError::new(locale::pick([
                "APIキーを1行・2560バイト以内で入力してください",
                "Enter the API key on one line, up to 2,560 bytes",
                "请在一行内输入 API 密钥，不超过 2560 字节",
                "請在一行內輸入 API 金鑰，不超過 2560 位元組",
                "API 키를 한 줄, 2,560바이트 이내로 입력하십시오",
            ]))));
        }
        let key = if action == "set" { key } else { None };
        self.runtime.api_key(backend, action, key).await.map_err(|_| {
            AppError::Runtime(
                locale::pick([
                    "APIキー設定を処理できませんでした。OSの資格情報ストアと実行環境を確認してください",
                    "Could not process the API key setting. Check the OS credential store and the agent runtime",
                    "无法处理 API 密钥设置。请检查操作系统的凭据存储和运行环境",
                    "無法處理 API 金鑰設定。請檢查作業系統的認證儲存區和執行環境",
                    "API 키 설정을 처리할 수 없습니다. OS의 자격 증명 저장소와 실행 환경을 확인하십시오",
                ])
                .to_owned(),
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
            return Err(AppError::validation(messages::cannot_start(&backend.label)));
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
        tokio::time::timeout(Duration::from_secs(20), settled)
            .await
            .map_err(|_| AppError::Runtime(messages::start_unconfirmed(&backend.label)))?
    }

    /// 使えないバックエンドの CLI を、公式のインストーラーで入れる
    pub async fn install_cli(&self, backend_id: &str) -> AppResult<()> {
        let Some(guide) = self.find(backend_id).ok().and_then(|backend| backend.setup.install) else {
            return Err(AppError::validation(locale::pick([
                "セットアップの対象が不正です",
                "The setup target is invalid",
                "设置对象无效",
                "設定對象無效",
                "설정 대상이 올바르지 않습니다",
            ])));
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
            Err(AppError::Runtime(messages::install_unconfirmed(&cli)))
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
            let message = messages::cannot_login(&backend.label);
            return Err(AppError::Validation(ValidationError::new(message)));
        }
        self.runtime.login(backend_id).await.map_err(|error| match error {
            RuntimeError::Cancelled => AppError::Runtime(
                locale::pick([
                    "ログインを中断しました",
                    "Sign-in was cancelled",
                    "已中断登录",
                    "已中斷登入",
                    "로그인을 중단했습니다",
                ])
                .to_owned(),
            ),
            RuntimeError::Failed(message) => AppError::Runtime(message),
        })
    }
}
