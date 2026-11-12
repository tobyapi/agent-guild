//! AIギルドの Rust 本体（アプリの頭脳）: infrastructure（ポートの実装）・interface（Tauri コマンド）・bootstrap（組み立て）。
//! ドメインとユースケースは crates/guild-domain・crates/guild-application。構成は docs/architecture.md。

mod bootstrap;
pub mod infrastructure;
pub mod interface;

use interface::commands::{agents, boot, channels, links, messages, profile, skills, snapshot, storage, update};
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
        .invoke_handler(tauri::generate_handler![
            boot::get_boot_status,
            boot::restart_app,
            boot::complete_setup,
            snapshot::get_snapshot,
            snapshot::refresh_backends,
            snapshot::install_backend_cli,
            snapshot::start_ollama,
            snapshot::backend_api_key,
            snapshot::login_backend,
            agents::create_agent,
            agents::update_agent,
            agents::delete_agent,
            agents::run_autonomous,
            agents::open_agent_workspace,
            skills::list_skills,
            skills::save_skill,
            skills::delete_skill,
            skills::list_builtin_skills,
            skills::add_builtin_skill,
            skills::get_skill_library,
            skills::set_skill_library_dirs,
            skills::add_library_skill,
            skills::reveal_skill_folder,
            channels::create_channel,
            channels::get_channel_statistics,
            channels::update_channel,
            channels::set_channel_workspace,
            channels::delete_channel,
            channels::add_channel_member,
            channels::remove_channel_member,
            messages::list_messages,
            messages::send_message,
            messages::get_attachment,
            messages::reveal_attachment,
            messages::stop_channel,
            messages::list_delegations,
            profile::update_profile,
            storage::get_storage_info,
            storage::choose_folder,
            storage::change_data_dir,
            storage::reveal_data_dir,
            links::open_url,
            update::check_update,
            update::install_update,
        ])
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
