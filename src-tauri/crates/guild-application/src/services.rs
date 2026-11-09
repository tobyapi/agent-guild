//! サービスの束（interface が Tauri の State として持つ）とポートの束。

use std::sync::Arc;

use guild_domain::storage::StorageInfo;

use crate::agents::AgentService;
use crate::autonomy::AutonomyService;
use crate::backends::BackendService;
use crate::channels::ChannelService;
use crate::conversation::ConversationService;
use crate::maintenance::Maintenance;
use crate::ports::{
    AgentRepository, AgentRuntime, AppControl, AttachmentStore, ChannelRepository, Clock, DataExporter,
    DelegationRepository, EventPublisher, Folders, IdGenerator, MessageRepository, MetaRepository, ProfileRepository,
    SettingsStore, SkillLibraryScanner, SkillRepository, Spawner, Workspace,
};
use crate::profile::ProfileService;
use crate::skills::library::SkillLibraryService;
use crate::skills::SkillService;
use crate::snapshot::SnapshotService;
use crate::storage::{Copier, StorageService};

/// 通常時に使うポート
#[derive(Clone)]
pub struct Ports {
    pub agents: Arc<dyn AgentRepository>,
    pub channels: Arc<dyn ChannelRepository>,
    pub messages: Arc<dyn MessageRepository>,
    /// 発言に貼られた画像の中身
    pub attachments: Arc<dyn AttachmentStore>,
    pub delegations: Arc<dyn DelegationRepository>,
    pub skills: Arc<dyn SkillRepository>,
    /// スキルライブラリのフォルダ（読むだけ）
    pub library: Arc<dyn SkillLibraryScanner>,
    pub profile: Arc<dyn ProfileRepository>,
    pub meta: Arc<dyn MetaRepository>,
    pub runtime: Arc<dyn AgentRuntime>,
    pub events: Arc<dyn EventPublisher>,
    pub workspace: Arc<dyn Workspace>,
    pub clock: Arc<dyn Clock>,
    pub ids: Arc<dyn IdGenerator>,
    pub spawner: Arc<dyn Spawner>,
}

/// 保存先の変更に使うポート（復旧モードでも使う）
#[derive(Clone)]
pub struct StoragePorts {
    /// いまのデータフォルダ（起動中は変わらない）
    pub info: StorageInfo,
    pub folders: Arc<dyn Folders>,
    pub settings: Arc<dyn SettingsStore>,
    pub control: Arc<dyn AppControl>,
}

/// 通常時のサービス一式
#[derive(Clone)]
pub struct AppServices {
    pub agents: AgentService,
    pub channels: ChannelService,
    pub skills: SkillService,
    pub library: SkillLibraryService,
    pub profile: ProfileService,
    pub snapshot: SnapshotService,
    pub backends: BackendService,
    pub conversation: ConversationService,
    pub autonomy: AutonomyService,
    pub storage: StorageService,
}

impl AppServices {
    /// 組み立てる（実行管理のアクターと、自発活動の基準になる起動時刻もここで決まる）
    pub fn new(ports: Ports, storage: StoragePorts, exporter: Arc<dyn DataExporter>) -> Self {
        let started_at = ports.clock.now_ms();
        let maintenance = Maintenance::default();
        let conversation = ConversationService::new(ports.clone(), maintenance.clone());
        let copier = Copier { exporter, conversation: conversation.clone(), maintenance: maintenance.clone() };
        Self {
            agents: AgentService::new(ports.clone(), conversation.clone()),
            channels: ChannelService::new(ports.clone(), conversation.clone()),
            skills: SkillService::new(ports.clone()),
            library: SkillLibraryService::new(ports.clone(), storage.settings.clone(), storage.folders.clone()),
            profile: ProfileService::new(ports.clone()),
            snapshot: SnapshotService::new(ports.clone(), conversation.clone()),
            backends: BackendService::new(ports.runtime.clone()),
            autonomy: AutonomyService::new(ports, conversation.clone(), maintenance, started_at),
            storage: StorageService::new(storage, Some(copier)),
            conversation,
        }
    }
}
