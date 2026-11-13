//! サービスの組み立て: 通常時（DB・ランナー・アダプタ一式）と、復旧モード（保存先の操作と言語の変更だけ）。
//! 言語の変更（LanguageService）はどちらのモードでも使うので、AppState とは別に State に入れる。

use std::error::Error;
use std::path::Path;
use std::sync::Arc;

use guild_application::language::LanguageService;
use guild_application::ports::{AgentRuntime, Clock, EventPublisher, SettingsStore, Spawner};
use guild_application::storage::StorageService;
use guild_application::{AppServices, Ports, StoragePorts};
use guild_domain::boot::BootStatus;
use guild_domain::locale::{self, Language};
use tauri::{AppHandle, Manager};

use super::boot::OpenedData;
use super::paths::AppPaths;
use super::{scheduler, seed};
use crate::infrastructure::app_control::TauriAppControl;
use crate::infrastructure::attachments::FsAttachments;
use crate::infrastructure::clock::SystemClock;
use crate::infrastructure::events::TauriEventPublisher;
use crate::infrastructure::export::DataExport;
use crate::infrastructure::folders::FsFolders;
use crate::infrastructure::frame_images::FsFrameImages;
use crate::infrastructure::ids::UuidGenerator;
use crate::infrastructure::runtime::RunnerRuntime;
use crate::infrastructure::settings::SettingsFile;
use crate::infrastructure::skill_library::FsSkillLibrary;
use crate::infrastructure::spawner::TauriSpawner;
use crate::infrastructure::sqlite::{
    SqliteAgentRepository, SqliteChannelRepository, SqliteDelegationRepository, SqliteFrameRepository,
    SqliteMessageRepository, SqliteMetaRepository, SqliteProfileRepository, SqliteSkillRepository,
    SqliteStatisticsRepository,
};
use crate::infrastructure::workspace::FsWorkspace;
use crate::interface::state::AppState;

/// 通常時: ランナーを起動し、サービスを組み立て、初期データを入れて、スケジューラを動かす
/// language は settings.json に保存した言語（BootStatus に添える。いまの言語は呼び出し側が設定済み）
pub fn ready(
    app: &AppHandle,
    paths: &AppPaths,
    opened: OpenedData,
    language: Option<Language>,
) -> Result<AppState, Box<dyn Error>> {
    let db = Arc::new(opened.database);
    let events: Arc<dyn EventPublisher> = Arc::new(TauriEventPublisher::new(app.clone()));
    let spawner: Arc<dyn Spawner> = Arc::new(TauriSpawner);
    let clock: Arc<dyn Clock> = Arc::new(SystemClock::new());
    let settings_file = SettingsFile::in_dir(&paths.config_dir);
    let auth_modes = settings_file.load()?.backend_auth_modes;
    let runtime = RunnerRuntime::start(events.clone(), spawner.as_ref(), paths.resource_dir.as_deref(), locale::current(), auth_modes);
    let ports = Ports {
        agents: Arc::new(SqliteAgentRepository::new(db.clone())),
        channels: Arc::new(SqliteChannelRepository::new(db.clone())),
        messages: Arc::new(SqliteMessageRepository::new(db.clone())),
        attachments: Arc::new(FsAttachments::new(&paths.data_dir)),
        delegations: Arc::new(SqliteDelegationRepository::new(db.clone())),
        statistics: Arc::new(SqliteStatisticsRepository::new(db.clone())),
        skills: Arc::new(SqliteSkillRepository::new(db.clone())),
        library: Arc::new(FsSkillLibrary),
        profile: Arc::new(SqliteProfileRepository::new(db.clone())),
        frames: Arc::new(SqliteFrameRepository::new(db.clone())),
        frame_images: Arc::new(FsFrameImages::new(&paths.data_dir)),
        meta: Arc::new(SqliteMetaRepository::new(db.clone())),
        runtime: runtime.clone(),
        events,
        workspace: Arc::new(FsWorkspace::new(&paths.data_dir)),
        clock: clock.clone(),
        ids: Arc::new(UuidGenerator),
        spawner: spawner.clone(),
    };
    let exporter = Arc::new(DataExport::new(db, paths.data_dir.clone()));
    let storage = storage_ports(app, paths);
    let runner: Arc<dyn AgentRuntime> = runtime.clone();
    app.manage(LanguageService::new(storage.settings.clone(), Some(runner)));
    let services = AppServices::new(ports.clone(), storage, exporter);
    seed::run_once(&services, ports.meta.as_ref())?;
    scheduler::start(services.autonomy.clone(), clock, spawner.as_ref());
    app.manage(runtime);
    app.manage(opened.lock);
    let boot = BootStatus::ok(display(&paths.data_dir), services.storage.needs_setup()).with_language(language);
    Ok(AppState::Ready { boot, services: Box::new(services) })
}

/// 復旧モード: サービスは起動せず、起動の結果と保存先の操作（と言語の変更）だけを持つ
pub fn recovery(app: &AppHandle, paths: &AppPaths, boot: BootStatus) -> AppState {
    let storage = storage_ports(app, paths);
    app.manage(LanguageService::new(storage.settings.clone(), None));
    AppState::Recovery { boot, storage: Box::new(StorageService::new(storage, None)) }
}

fn storage_ports(app: &AppHandle, paths: &AppPaths) -> StoragePorts {
    StoragePorts {
        info: paths.storage_info(),
        folders: Arc::new(FsFolders::new(paths.data_dir.clone(), paths.default_data_dir.clone())),
        settings: Arc::new(SettingsFile::in_dir(&paths.config_dir)),
        control: Arc::new(TauriAppControl::new(app.clone())),
    }
}

fn display(path: &Path) -> String {
    path.display().to_string()
}
