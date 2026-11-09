//! Tauri の State として持つもの: 通常時はサービス一式、復旧モード（design.md §11）では起動の結果と保存先の操作だけ。

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
            Self::Recovery { .. } => Err(CommandError::new(
                ErrorCode::Unavailable,
                "データフォルダを開けなかったため、いまは使えません",
            )),
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
