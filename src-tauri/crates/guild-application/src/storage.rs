//! 保存先の変更（design.md §11）。復旧モードでも動く（そのときは copy できない）。

use std::path::{Path, PathBuf};
use std::sync::Arc;

use guild_domain::error::ValidationError;
use guild_domain::storage::{DataDirMode, StorageInfo, StorageSource};

use crate::conversation::ConversationService;
use crate::error::{AppError, AppResult};
use crate::maintenance::Maintenance;
use crate::ports::{DataExporter, FolderState, TargetFolder};
use crate::services::StoragePorts;

/// copy に必要なもの（通常時だけ）
#[derive(Clone)]
pub struct Copier {
    pub exporter: Arc<dyn DataExporter>,
    pub conversation: ConversationService,
    pub maintenance: Maintenance,
}

#[derive(Clone)]
pub struct StorageService {
    ports: StoragePorts,
    copier: Option<Copier>,
}

impl StorageService {
    /// copier が None なら復旧モード（copy は unavailable）
    pub fn new(ports: StoragePorts, copier: Option<Copier>) -> Self {
        Self { ports, copier }
    }

    pub fn info(&self) -> StorageInfo {
        self.ports.info.clone()
    }

    pub fn reveal(&self) -> AppResult<()> {
        self.ports.folders.reveal(Path::new(&self.ports.info.data_dir))
    }

    /// 検証してから copy / open し、settings.json を書いて再起動する
    pub async fn change_data_dir(&self, path: &str, mode: DataDirMode) -> AppResult<()> {
        if self.ports.info.source == StorageSource::Env {
            return Err(AppError::validation("環境変数 GUILD_DATA_DIR で保存先が指定されているため、変更できません"));
        }
        let target = PathBuf::from(path.trim());
        if !target.is_absolute() {
            return Err(validation("保存先は絶対パスで指定してください"));
        }
        let folder = self.ports.folders.inspect(&target)?;
        check_location(&folder)?;
        match mode {
            DataDirMode::Copy => {
                check_copy_target(&folder.state)?;
                self.copy_to(&target).await?;
            }
            DataDirMode::Open => check_open_target(&folder.state)?,
        }
        let data_dir = (!folder.is_default).then_some(target);
        if let Err(error) = self.save_data_dir(data_dir) {
            self.end_maintenance();
            return Err(error);
        }
        self.ports.control.restart();
        Ok(())
    }

    /// 初回起動の初期設定がまだか（settings.json を読めなければ、終えられないので出さない）
    pub fn needs_setup(&self) -> bool {
        self.ports.settings.load().is_ok_and(|settings| !settings.setup_done)
    }

    /// 初回起動の初期設定を終えた印を settings.json に書く（次の起動から初期設定のダイアログを出さない）
    pub fn complete_setup(&self) -> AppResult<()> {
        let mut settings = self.ports.settings.load()?;
        settings.setup_done = true;
        self.ports.settings.save(&settings)
    }

    /// settings.json の保存先だけを書き換える（ほかの項目はそのまま）
    fn save_data_dir(&self, data_dir: Option<PathBuf>) -> AppResult<()> {
        let mut settings = self.ports.settings.load()?;
        settings.data_dir = data_dir;
        self.ports.settings.save(&settings)
    }

    fn end_maintenance(&self) {
        if let Some(copier) = &self.copier {
            copier.maintenance.end();
        }
    }

    /// メンテナンス状態に入り、全チャンネルを止めて終端を待ってから書き出す。失敗したらメンテナンスを解く
    async fn copy_to(&self, target: &Path) -> AppResult<()> {
        let Some(copier) = &self.copier else {
            return Err(AppError::Unavailable(
                "いまのデータを読み込めないため、コピーできません。「その場所のデータを開く」を選んでください".to_owned(),
            ));
        };
        copier.maintenance.begin();
        copier.conversation.stop_all().await;
        copier.exporter.export_to(target).inspect_err(|_| copier.maintenance.end())
    }
}

fn check_location(folder: &TargetFolder) -> AppResult<()> {
    if folder.is_current {
        return Err(validation("いまの保存先と同じフォルダです"));
    }
    if folder.is_nested {
        return Err(validation("いまの保存先と入れ子になるフォルダは選べません"));
    }
    Ok(())
}

fn check_copy_target(state: &FolderState) -> AppResult<()> {
    match state {
        FolderState::Empty => Ok(()),
        FolderState::Guild | FolderState::IncompatibleGuild(_) => Err(AppError::Conflict(
            "移動先にすでにデータがあります。『その場所のデータを開く』を選んでください。".to_owned(),
        )),
        FolderState::Foreign => Err(validation("移動先には空のフォルダを選んでください")),
    }
}

fn check_open_target(state: &FolderState) -> AppResult<()> {
    match state {
        FolderState::Empty | FolderState::Guild => Ok(()),
        FolderState::IncompatibleGuild(reason) => Err(validation(reason)),
        FolderState::Foreign => Err(validation("ギルドのデータフォルダではありません")),
    }
}

/// 選んだフォルダ（path）の問題
fn validation(message: &str) -> AppError {
    AppError::Validation(ValidationError::on("path", message))
}
