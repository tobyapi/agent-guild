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
use crate::infrastructure::ids::UuidGenerator;
use crate::infrastructure::settings::SettingsFile;
use crate::infrastructure::skill_library::FsSkillLibrary;
use crate::infrastructure::sqlite::{
    Database, SqliteAgentRepository, SqliteChannelRepository, SqliteDelegationRepository, SqliteMessageRepository,
    SqliteMetaRepository, SqliteProfileRepository, SqliteSkillRepository, SqliteStatisticsRepository,
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
async fn seeds_the_lobby_five_agents_and_their_skills_once() {
    let dir = TempDir::new("seed");
    let (services, meta) = services(&dir);
    run_once(&services, meta.as_ref()).unwrap();
    run_once(&services, meta.as_ref()).unwrap();

    let snapshot = services.snapshot.get().unwrap();
    let names: Vec<&str> = snapshot.agents.iter().map(|a| a.name.as_str()).collect();
    assert_eq!(names, vec!["ハル", "ソラ", "ロジカ", "ギア", "カナメ"], "2回目は入れない");
    let colors: Vec<&str> = snapshot.agents.iter().map(|a| a.color.as_str()).collect();
    assert_eq!(colors, vec!["#cb9d2a", "#22b5e1", "#7ca2f6", "#e28d4f", "#d285cb"]);
    let tags: Vec<Vec<String>> = snapshot.agents.iter().map(|a| a.tags.clone()).collect();
    let expected: [&[&str]; 5] =
        [&["作業者", "リサーチ"], &["作業者", "実装"], &["専門家", "レビュー"], &["専門家", "設計"], &["マネージャー"]];
    assert_eq!(tags, expected.map(|tags| tags.iter().map(|tag| (*tag).to_owned()).collect::<Vec<_>>()));
    let (haru, sora, logica) = (&snapshot.agents[0], &snapshot.agents[1], &snapshot.agents[2]);
    assert_eq!(sora.backend, "codex");
    assert!(sora.permissions.run_commands && sora.permissions.write_files, "ソラはテンプレート＋コマンド実行");
    assert!(!haru.permissions.run_commands);
    assert_eq!((haru.unmentioned, haru.consultable), (UnmentionedPolicy::Answer, false));
    assert_eq!((logica.unmentioned, logica.consultable), (UnmentionedPolicy::Fallback, true));
    assert!(!logica.permissions.write_files);
    let kaname = &snapshot.agents[4];
    assert_eq!((kaname.backend.as_str(), kaname.avatar.as_str()), ("codex", "🧭"));
    assert_eq!(
        (kaname.unmentioned, kaname.can_delegate),
        (UnmentionedPolicy::Lead, true),
        "マネージャーのテンプレート"
    );
    assert_eq!(kaname.expertise, "段取りと進行管理", "省いた得意分野はテンプレートの書き出し");
    assert_eq!(snapshot.me.color, "#f0ba5f");

    let lobby = &snapshot.channels[0];
    assert_eq!((lobby.name.as_str(), lobby.topic.as_str()), ("ロビー", "みんなの雑談と相談の場"));
    assert_eq!(lobby.member_ids.len(), 6);
    assert_eq!(lobby.member_ids[0], MemberId::Human);

    let logica_skills = services.skills.list(&snapshot.agents[2].id).unwrap();
    assert_eq!(logica_skills[0].name, "review-checklist");
    assert!(logica_skills[0].body.contains("## 2. 根拠を確かめる"));
    assert_eq!(services.skills.list(&snapshot.agents[3].id).unwrap()[0].name, "code-review");

    let welcome = services.conversation.list_messages(&lobby.id, None, None).unwrap();
    assert_eq!(welcome.len(), 1);
    assert!(welcome[0].content.starts_with("AIギルドへようこそ"));
}
