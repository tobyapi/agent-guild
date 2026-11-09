//! アプリの再起動（AppControl の実装）。終了処理（ランナーの shutdown など）を経てから起動し直す。

use guild_application::ports::AppControl;
use tauri::AppHandle;

pub struct TauriAppControl {
    app: AppHandle,
}

impl TauriAppControl {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl AppControl for TauriAppControl {
    /// restart() は呼んだスレッドを止めてしまうので、終了を依頼して戻る request_restart() を使う
    fn restart(&self) {
        self.app.request_restart();
    }
}
