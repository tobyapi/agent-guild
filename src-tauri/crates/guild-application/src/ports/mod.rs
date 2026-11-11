//! 外界とのポート（トレイト）。実装は本体クレートの infrastructure、テストではインメモリのフェイク。

mod attachments;
mod library;
mod repositories;
mod runtime;
mod storage;
mod system;

pub use attachments::AttachmentStore;
pub use library::{DirProblem, DirScan, FoundSkill, SkillFileError, SkillLibraryScanner};
pub use repositories::{
    AgentRepository, ChannelRepository, DelegationRepository, MessageFilter, MessageRepository, MetaRepository,
    ProfileRepository, SkillRepository, StatisticsRepository,
};
pub use runtime::{
    AgentRuntime, ImagePayload, RunUpdate, RuntimeError, RuntimeRequest, SkillFilePayload, SkillPayload, UpdateSink,
};
pub use storage::{DataExporter, FolderState, Folders, LaunchSettings, SettingsStore, TargetFolder};
pub use system::{AppControl, BoxTask, Clock, EventPublisher, IdGenerator, Spawner, Workspace, WorkspacePaths};
