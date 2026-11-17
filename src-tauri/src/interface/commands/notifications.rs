//! 利用者向けの設定だけを公開する。通知を送信するIPCは設けない。
use super::{reject, CommandResult};
use guild_application::notifications::NotificationService;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn get_desktop_notifications(service: State<'_, Arc<NotificationService>>) -> CommandResult<bool> {
    service.enabled().map_err(reject)
}
#[tauri::command]
pub async fn set_desktop_notifications(
    enabled: bool,
    service: State<'_, Arc<NotificationService>>,
) -> CommandResult<()> {
    service.set_enabled(enabled).map_err(reject)
}
