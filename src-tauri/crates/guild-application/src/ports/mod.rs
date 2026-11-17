//! 外界とのポート（トレイト）。実装は本体クレートの infrastructure、テストではインメモリのフェイク。

mod attachments;
mod frame_images;
mod library;
mod repositories;
mod runtime;
mod storage;
mod system;

pub use attachments::AttachmentStore;
pub use frame_images::{FrameImageStore, FrameImportError};
pub use library::{DirProblem, DirScan, FoundSkill, SkillFileError, SkillLibraryScanner};
pub use repositories::{
    AgentRegistration, AgentRepository, ChannelRepository, DelegationRepository, FrameRepository, MessageFilter,
    MessageRepository, MetaRepository, ProfileRepository, SkillRecordRepository, SkillRepository, StatisticsRepository,
};
pub use runtime::{
    AgentRuntime, ImagePayload, ImageRuntimeRequest, RunUpdate, RuntimeError, RuntimeRequest, SkillFilePayload,
    SkillPayload, UpdateSink,
};
pub use storage::{DataExporter, FolderState, Folders, LaunchSettings, SettingsStore, TargetFolder};
pub use system::{
    AppControl, BoxTask, Clock, DesktopNotifier, EventPublisher, IdGenerator, Spawner, Workspace, WorkspacePaths,
};
