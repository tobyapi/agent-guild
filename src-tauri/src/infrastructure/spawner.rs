//! タスクの生成（Spawner の実装）。Tauri の非同期ランタイム（tokio）の上で動かす。

use guild_application::ports::{BoxTask, Spawner};

#[derive(Debug, Default)]
pub struct TauriSpawner;

impl Spawner for TauriSpawner {
    fn spawn(&self, task: BoxTask) {
        tauri::async_runtime::spawn(task);
    }
}
