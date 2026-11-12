//! 初期データ: 本物の SQLite のリポジトリで、1回だけ入ることと中身（design.md §13）を確かめる。

use std::sync::Arc;

use guild_application::ports::{BoxTask, Spawner};
use guild_application::{AppServices, Ports, StoragePorts};
use guild_domain::agent::UnmentionedPolicy;
use guild_domain::author::MemberId;
use guild_domain::storage::StorageSource;

use super::{NoRuntime, Silent, TempDir};
use crate::bootstrap::seed::run_once;
use crate::infrastructure::attachments::FsAttachments;
use crate::infrastructure::clock::SystemClock;
use crate::infrastructure::export::DataExport;
use crate::infrastructure::folders::FsFolders;
use crate::infrastructure::frame_images::FsFrameImages;
use crate::infrastructure::ids::UuidGenerator;
use crate::infrastructure::settings::SettingsFile;
use crate::infrastructure::skill_library::FsSkillLibrary;
use crate::infrastructure::sqlite::{
    Database, SqliteAgentRepository, SqliteChannelRepository, SqliteDelegationRepository, SqliteFrameRepository,
    SqliteMessageRepository, SqliteMetaRepository, SqliteProfileRepository, SqliteSkillRepository,
    SqliteStatisticsRepository,
};
use crate::infrastructure::workspace::FsWorkspace;

struct TokioSpawner;

impl Spawner for TokioSpawner {
    fn spawn(&self, task: BoxTask) {
        tokio::spawn(task);
    }
}

fn services(dir: &TempDir) -> (AppServices, Arc<SqliteMetaRepository>) {
    let db = Arc::new(Database::open_in_memory().unwrap());
    let meta = Arc::new(SqliteMetaRepository::new(db.clone()));
    let ports = Ports {
        agents: Arc::new(SqliteAgentRepository::new(db.clone())),
        channels: Arc::new(SqliteChannelRepository::new(db.clone())),
        messages: Arc::new(SqliteMessageRepository::new(db.clone())),
        attachments: Arc::new(FsAttachments::new(&dir.0)),
        delegations: Arc::new(SqliteDelegationRepository::new(db.clone())),
        statistics: Arc::new(SqliteStatisticsRepository::new(db.clone())),
        skills: Arc::new(SqliteSkillRepository::new(db.clone())),
        library: Arc::new(FsSkillLibrary),
        profile: Arc::new(SqliteProfileRepository::new(db.clone())),
        frames: Arc::new(SqliteFrameRepository::new(db.clone())),
        frame_images: Arc::new(FsFrameImages::new(&dir.0)),
        meta: meta.clone(),
        runtime: Arc::new(NoRuntime),
        events: Arc::new(Silent),
        workspace: Arc::new(FsWorkspace::new(&dir.0)),
        clock: Arc::new(SystemClock::new()),
        ids: Arc::new(UuidGenerator),
        spawner: Arc::new(TokioSpawner),
    };
    let info = guild_domain::storage::StorageInfo {
        data_dir: dir.0.display().to_string(),
        default_data_dir: dir.0.display().to_string(),
        source: StorageSource::Default,
    };
    let storage = StoragePorts {
        info,
        folders: Arc::new(FsFolders::new(dir.0.clone(), dir.0.clone())),
        settings: Arc::new(SettingsFile::in_dir(&dir.0)),
        control: Arc::new(Silent),
    };
    let exporter = Arc::new(DataExport::new(db, dir.0.clone()));
    (AppServices::new(ports, storage, exporter), meta)
}

#[tokio::test]
async fn seeds_the_lobby_with_one_worker_and_an_embedded_avatar_once() {
    let dir = TempDir::new("seed");
    let (services, meta) = services(&dir);
    run_once(&services, meta.as_ref()).unwrap();
    run_once(&services, meta.as_ref()).unwrap();

    let snapshot = services.snapshot.get().unwrap();
    assert_eq!(snapshot.agents.len(), 1);
    let worker = &snapshot.agents[0];
    assert_eq!(worker.name, "白龙娘");
    assert_eq!(worker.tags, ["作業者", "リサーチ"]);
    assert_eq!((worker.backend.as_str(), worker.model.as_str()), ("codex", ""));
    assert!(worker.avatar.starts_with("data:image/jpeg;base64,/9j/"));
    assert!(worker.permissions.write_files && worker.permissions.run_commands && worker.permissions.write_anywhere);
    assert_eq!(
        (worker.unmentioned, worker.consultable, worker.can_delegate),
        (UnmentionedPolicy::Answer, false, false)
    );
    assert!(services.skills.list(&worker.id).unwrap().is_empty());

    assert_eq!(snapshot.channels.len(), 1);
    let lobby = &snapshot.channels[0];
    assert_eq!((lobby.name.as_str(), lobby.topic.as_str()), ("ロビー", "みんなの雑談と相談の場"));
    assert_eq!(lobby.member_ids, [MemberId::Human, MemberId::Agent(worker.id.clone())]);

    let welcome = services.conversation.list_messages(&lobby.id, None, None).unwrap();
    assert_eq!(welcome.len(), 1);
    assert!(welcome[0].content.contains("白龙娘"));
}
