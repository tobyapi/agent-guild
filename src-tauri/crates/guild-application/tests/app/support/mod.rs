//! フェイクのポートでアプリを組み立てるテスト用の土台。

pub mod attachments;
pub mod events;
pub mod library;
pub mod records;
pub mod runtime;
pub mod store;
pub mod system;

use std::sync::Arc;
use std::time::Duration;

use guild_application::{AppServices, Ports, StoragePorts};
use guild_domain::agent::{find_template, Agent, AgentInput};
use guild_domain::author::{Author, MemberId};
use guild_domain::channel::Channel;
use guild_domain::message::Message;
use guild_domain::storage::{StorageInfo, StorageSource};

use attachments::FakeAttachments;
use events::FakeEvents;
use library::FakeLibrary;
use runtime::FakeRuntime;
use store::MemoryStore;
use system::{FakeClock, FakeControl, FakeExporter, FakeFolders, FakeIds, FakeSettings, FakeWorkspace, TokioSpawner};

pub const STARTED_AT: i64 = 1_000_000;

pub struct TestApp {
    pub services: AppServices,
    pub store: Arc<MemoryStore>,
    pub ids: Arc<FakeIds>,
    pub attachments: Arc<FakeAttachments>,
    pub runtime: Arc<FakeRuntime>,
    pub events: Arc<FakeEvents>,
    pub workspace: Arc<FakeWorkspace>,
    pub library: Arc<FakeLibrary>,
    pub folders: Arc<FakeFolders>,
    pub exporter: Arc<FakeExporter>,
    pub settings: Arc<FakeSettings>,
    pub control: Arc<FakeControl>,
}

impl TestApp {
    /// tokio のランタイムの中で呼ぶ（実行管理のアクターを起動する）
    pub fn new() -> Self {
        Self::with_source(StorageSource::Default)
    }

    pub fn with_source(source: StorageSource) -> Self {
        Self::assemble(source, Arc::new(MemoryStore::default()), Arc::new(FakeIds::default()))
    }

    /// 同じ記録（ストア）と ID の続きのまま組み立て直す（アプリの再起動）。前のアプリのジョブは止まったまま残る
    pub fn restart(&self) -> Self {
        Self::assemble(StorageSource::Default, self.store.clone(), self.ids.clone())
    }

    fn assemble(source: StorageSource, store: Arc<MemoryStore>, ids: Arc<FakeIds>) -> Self {
        let runtime = Arc::new(FakeRuntime::with_backend("claude"));
        let (events, workspace) = (Arc::new(FakeEvents::default()), Arc::new(FakeWorkspace::default()));
        let (clock, library) = (Arc::new(FakeClock::starting_at(STARTED_AT)), Arc::new(FakeLibrary::default()));
        let attachments = Arc::new(FakeAttachments::default());
        let ports = Ports {
            agents: store.clone(),
            channels: store.clone(),
            messages: store.clone(),
            attachments: attachments.clone(),
            delegations: store.clone(),
            statistics: store.clone(),
            skills: store.clone(),
            library: library.clone(),
            profile: store.clone(),
            meta: store.clone(),
            runtime: runtime.clone(),
            events: events.clone(),
            workspace: workspace.clone(),
            clock,
            ids: ids.clone(),
            spawner: Arc::new(TokioSpawner),
        };
        let (folders, settings, control) =
            (Arc::new(FakeFolders::default()), Arc::new(FakeSettings::default()), Arc::new(FakeControl::default()));
        let info = StorageInfo { data_dir: "C:\\guild".to_owned(), default_data_dir: "C:\\guild".to_owned(), source };
        let storage =
            StoragePorts { info, folders: folders.clone(), settings: settings.clone(), control: control.clone() };
        let exporter = Arc::new(FakeExporter::default());
        let services = AppServices::new(ports, storage, exporter.clone());
        Self {
            services,
            store,
            ids,
            attachments,
            runtime,
            events,
            workspace,
            library,
            folders,
            exporter,
            settings,
            control,
        }
    }

    /// エージェントを作る（template はテンプレート ID、ID は作成後に決まる）
    pub fn agent(&self, template: &str, name: &str) -> Agent {
        let events_before = self.events.skills_changed.lock().len();
        let agent = self.services.agents.create(input(template, name)).unwrap_or_else(|e| panic!("{name}: {e}"));
        // この汎用フィクスチャはスキルなし。既定スキルは role_skills.rs で作成から検証する。
        self.store.skills.lock().retain(|skill| skill.agent_id != agent.id);
        self.events.skills_changed.lock().truncate(events_before);
        agent
    }

    pub fn channel(&self, name: &str, members: &[&Agent]) -> Channel {
        let members: Vec<MemberId> = members.iter().map(|a| MemberId::Agent(a.id.clone())).collect();
        self.services.channels.create(name, "", &members).unwrap_or_else(|e| panic!("{name}: {e}"))
    }

    /// 実行管理が落ち着く（待機も実行中もない状態が続く）まで待つ
    pub async fn settle(&self) {
        let mut quiet = 0;
        for _ in 0..2_000 {
            tokio::time::sleep(Duration::from_millis(1)).await;
            quiet = if self.services.conversation.activity().queues.is_empty() { quiet + 1 } else { 0 };
            if quiet >= 20 {
                return;
            }
        }
        panic!("実行管理が落ち着きません: {:?}", self.services.conversation.activity());
    }

    /// そのチャンネルの発言（seq 順）を「発言者の名前: 本文」で
    pub fn transcript(&self, channel: &Channel) -> Vec<String> {
        let agents = self.store.agents.lock().clone();
        let name = |author: &Author| match author {
            Author::Human => "人間".to_owned(),
            Author::System => "システム".to_owned(),
            Author::Agent(id) => agents.iter().find(|a| &a.id == id).map(|a| a.name.clone()).unwrap_or_default(),
        };
        self.messages(channel).iter().map(|m| format!("{}: {}", name(&m.author_id), m.content)).collect()
    }

    pub fn messages(&self, channel: &Channel) -> Vec<Message> {
        let messages = self.store.messages.lock();
        messages.iter().filter(|m| m.channel_id == channel.id).cloned().collect()
    }
}

/// テンプレートの既定値から作る入力
pub fn input(template: &str, name: &str) -> AgentInput {
    let defaults = find_template(template).unwrap_or_else(|| panic!("テンプレート {template} がありません")).defaults;
    AgentInput {
        name: name.to_owned(),
        tags: defaults.tags,
        avatar: "🙂".to_owned(),
        color: "#cb9d2a".to_owned(),
        role: format!("{name}の役割"),
        personality: String::new(),
        tone: String::new(),
        expertise: format!("{name}の専門"),
        backend: "claude".to_owned(),
        model: String::new(),
        backend_options: serde_json::Map::new(),
        permissions: defaults.permissions,
        unmentioned: defaults.unmentioned,
        consultable: defaults.consultable,
        can_delegate: defaults.can_delegate,
        autonomy_enabled: defaults.autonomy_enabled,
        autonomy_interval_min: 60,
        autonomy_channel_id: None,
    }
}
