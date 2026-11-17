//! AIギルドの Rust 本体（アプリの頭脳）: infrastructure（ポートの実装）・interface（Tauri コマンド）・bootstrap（組み立て）。
//! ドメインとユースケースは crates/guild-domain・crates/guild-application。構成は docs/architecture.md。

mod bootstrap;
pub mod infrastructure;
pub mod interface;

use interface::state::BeforeUpdate;
use tauri::Manager;

/// 起動時の組み立て。更新を入れる直前の片付け（ランナーを止める）もここで渡す
fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    app.manage(BeforeUpdate::new(move || bootstrap::stop_runner(handle.clone())));
    bootstrap::setup(app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(setup)
        .invoke_handler(interface::commands::registry::handler())
        .build(tauri::generate_context!());
    start(app);
}

/// 窓を開いて動かす。終了時（再起動を含む）にランナーを止める
fn start(app: tauri::Result<tauri::App>) {
    match app {
        Ok(app) => app.run(|handle, event| {
            if let tauri::RunEvent::Exit = event {
                bootstrap::shutdown(handle);
            }
        }),
        Err(error) => {
            log::error!("アプリを起動できませんでした: {error}");
            std::process::exit(1);
        }
    }
}
