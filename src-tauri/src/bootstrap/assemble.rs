//! サービスの組み立て: 通常時（DB・ランナー・アダプタ一式）と、復旧モード（保存先の操作だけ）。

use std::error::Error;
use std::path::Path;
use std::sync::Arc;

use guild_application::ports::{Clock, EventPublisher, Spawner};
use guild_application::storage::StorageService;
use guild_application::{AppServices, Ports, StoragePorts};
use guild_domain::boot::BootStatus;
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
use crate::infrastructure::ids::UuidGenerator;
use crate::infrastructure::runtime::RunnerRuntime;
use crate::infrastructure::settings::SettingsFile;
use crate::infrastructure::skill_library::FsSkillLibrary;
use crate::infrastructure::spawner::TauriSpawner;
use crate::infrastructure::sqlite::{
    SqliteAgentRepository, SqliteChannelRepository, SqliteDelegationRepository, SqliteMessageRepository,
    SqliteMetaRepository, SqliteProfileRepository, SqliteSkillRepository,
};
use crate::infrastructure::workspace::FsWorkspace;
use crate::interface::state::AppState;

/// 通常時: ランナーを起動し、サービスを組み立て、初期データを入れて、スケジューラを動かす
pub fn ready(app: &AppHandle, paths: &AppPaths, opened: OpenedData) -> Result<AppState, Box<dyn Error>> {
    let db = Arc::new(opened.database);
    let events: Arc<dyn EventPublisher> = Arc::new(TauriEventPublisher::new(app.clone()));
    let spawner: Arc<dyn Spawner> = Arc::new(TauriSpawner);
    let clock: Arc<dyn Clock> = Arc::new(SystemClock::new());
    let runtime = RunnerRuntime::start(events.clone(), spawner.as_ref());
    let ports = Ports {
        agents: Arc::new(SqliteAgentRepository::new(db.clone())),
        channels: Arc::new(SqliteChannelRepository::new(db.clone())),
        messages: Arc::new(SqliteMessageRepository::new(db.clone())),
        attachments: Arc::new(FsAttachments::new(&paths.data_dir)),
        delegations: Arc::new(SqliteDelegationRepository::new(db.clone())),
        skills: Arc::new(SqliteSkillRepository::new(db.clone())),
        library: Arc::new(FsSkillLibrary),
        profile: Arc::new(SqliteProfileRepository::new(db.clone())),
        meta: Arc::new(SqliteMetaRepository::new(db.clone())),
        runtime: runtime.clone(),
        events,
        workspace: Arc::new(FsWorkspace::new(&paths.data_dir)),
        clock: clock.clone(),
        ids: Arc::new(UuidGenerator),
        spawner: spawner.clone(),
    };
    let exporter = Arc::new(DataExport::new(db, paths.data_dir.clone()));
    let services = AppServices::new(ports.clone(), storage_ports(app, paths), exporter);
    seed::run_once(&services, ports.meta.as_ref())?;
    scheduler::start(services.autonomy.clone(), clock, spawner.as_ref());
    app.manage(runtime);
    app.manage(opened.lock);
    Ok(AppState::Ready { boot: BootStatus::ok(display(&paths.data_dir)), services: Box::new(services) })
}

/// 復旧モード: サービスは起動せず、起動の結果と保存先の操作だけを持つ
pub fn recovery(app: &AppHandle, paths: &AppPaths, boot: BootStatus) -> AppState {
    AppState::Recovery { boot, storage: Box::new(StorageService::new(storage_ports(app, paths), None)) }
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

