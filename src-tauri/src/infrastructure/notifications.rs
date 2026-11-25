//! OS通知アダプタ。Rustからのみ呼び出し、Webviewに通知送信コマンドを公開しない。
use guild_application::{ports::DesktopNotifier, AppError, AppResult};

/// アプリのインストーラーが登録する識別子だけを受け取る。
pub struct TauriNotifier(#[cfg_attr(not(windows), allow(dead_code))] pub String);
impl DesktopNotifier for TauriNotifier {
    fn submit(&self, title: &str, body: &str) -> AppResult<()> {
        let mut notification = notify_rust::Notification::new();
        notification.summary(title).body(body);
        // The installer registers this Windows AUMID. Development builds use the library's
        // PowerShell identity, which does not require installing the app.
        #[cfg(windows)]
        if !tauri::is_dev() {
            notification.app_id(&self.0);
        }
        notification.show().map(|_| ()).map_err(|error| AppError::Storage(error.to_string()))
    }
}
