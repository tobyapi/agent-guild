//! Tauri の State として持つもの: 通常時はサービス一式、復旧モード（design.md §11）では起動の結果と保存先の操作だけ。

use std::future::Future;
use std::pin::Pin;

use guild_application::storage::StorageService;
use guild_application::AppServices;
use guild_domain::boot::BootStatus;
use guild_domain::error::{CommandError, ErrorCode};

pub enum AppState {
    Ready { boot: BootStatus, services: Box<AppServices> },
    Recovery { boot: BootStatus, storage: Box<StorageService> },
}

impl AppState {
    pub fn boot(&self) -> &BootStatus {
        match self {
            Self::Ready { boot, .. } | Self::Recovery { boot, .. } => boot,
        }
    }

    /// 通常時のサービス。復旧モードでは unavailable
    pub fn services(&self) -> Result<&AppServices, CommandError> {
        match self {
            Self::Ready { services, .. } => Ok(services),
            Self::Recovery { .. } => {
                Err(CommandError::new(ErrorCode::Unavailable, "データフォルダを開けなかったため、いまは使えません"))
            }
        }
    }

    /// 保存先の操作（復旧モードでも使える）
    pub fn storage(&self) -> &StorageService {
        match self {
            Self::Ready { services, .. } => &services.storage,
            Self::Recovery { storage, .. } => storage,
        }
    }
}

type BoxedFuture = Pin<Box<dyn Future<Output = ()> + Send>>;

/// 更新を入れる直前の片付け（ランナーを止める）。組み立て役（lib.rs）が中身を渡す
pub struct BeforeUpdate(Box<dyn Fn() -> BoxedFuture + Send + Sync>);

impl BeforeUpdate {
    pub fn new<F, Fut>(prepare: F) -> Self
    where
        F: Fn() -> Fut + Send + Sync + 'static,
        Fut: Future<Output = ()> + Send + 'static,
    {
        Self(Box::new(move || Box::pin(prepare())))
    }

    pub async fn run(&self) {
        (self.0)().await;
    }
}
