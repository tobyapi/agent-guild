//! 保存先の変更（design.md §11）。復旧モードでも動く（そのときは copy できない）。

use std::path::{Path, PathBuf};
use std::sync::Arc;

use guild_domain::error::ValidationError;
use guild_domain::locale;
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
            return Err(AppError::validation(locale::pick([
                "環境変数 GUILD_DATA_DIR で保存先が指定されているため、変更できません",
                "The data location cannot be changed because it is set by the GUILD_DATA_DIR environment variable",
                "数据存储位置已由环境变量 GUILD_DATA_DIR 指定，无法更改",
                "資料儲存位置已由環境變數 GUILD_DATA_DIR 指定，無法變更",
                "환경 변수 GUILD_DATA_DIR로 데이터 저장 위치가 지정되어 있어 변경할 수 없습니다",
            ])));
        }
        let target = PathBuf::from(path.trim());
        if !target.is_absolute() {
            return Err(validation(locale::pick([
                "保存先は絶対パスで指定してください",
                "Specify the data location as an absolute path",
                "请使用绝对路径指定数据存储位置",
                "請使用絕對路徑指定資料儲存位置",
                "데이터 저장 위치는 절대 경로로 지정하십시오",
            ])));
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
                locale::pick([
                    "いまのデータを読み込めないため、コピーできません。「その場所のデータを開く」を選んでください",
                    "The current data cannot be loaded, so it cannot be copied. Choose “Open the data in that location”",
                    "无法读取当前数据，因此无法复制。请选择“打开该位置的数据”",
                    "無法讀取目前的資料，因此無法複製。請選擇「開啟該位置的資料」",
                    "현재 데이터를 읽을 수 없어 복사할 수 없습니다. \"그 위치의 데이터 열기\"를 선택하십시오",
                ])
                .to_owned(),
            ));
        };
        copier.maintenance.begin();
        copier.conversation.stop_all().await;
        copier.exporter.export_to(target).inspect_err(|_| copier.maintenance.end())
    }
}

fn check_location(folder: &TargetFolder) -> AppResult<()> {
    if folder.is_current {
        return Err(validation(locale::pick([
            "いまの保存先と同じフォルダです",
            "This is the same folder as the current data location",
            "与当前数据存储位置是同一个文件夹",
            "與目前資料儲存位置是同一個資料夾",
            "현재 데이터 저장 위치와 같은 폴더입니다",
        ])));
    }
    if folder.is_nested {
        return Err(validation(locale::pick([
            "いまの保存先と入れ子になるフォルダは選べません",
            "You cannot choose a folder nested with the current data location",
            "不能选择与当前数据存储位置相互嵌套的文件夹",
            "不能選擇與目前資料儲存位置相互巢狀的資料夾",
            "현재 데이터 저장 위치와 중첩되는 폴더는 선택할 수 없습니다",
        ])));
    }
    Ok(())
}

fn check_copy_target(state: &FolderState) -> AppResult<()> {
    match state {
        FolderState::Empty => Ok(()),
        FolderState::Guild | FolderState::IncompatibleGuild(_) => Err(AppError::Conflict(
            locale::pick([
                "移動先にすでにデータがあります。『その場所のデータを開く』を選んでください。",
                "The destination already contains data. Choose “Open the data in that location”.",
                "目标位置已有数据。请选择“打开该位置的数据”。",
                "目標位置已有資料。請選擇「開啟該位置的資料」。",
                "이동할 위치에 이미 데이터가 있습니다. \"그 위치의 데이터 열기\"를 선택하십시오.",
            ])
            .to_owned(),
        )),
        FolderState::Foreign => Err(validation(locale::pick([
            "移動先には空のフォルダを選んでください",
            "Choose an empty folder as the destination",
            "请选择空文件夹作为目标位置",
            "請選擇空白資料夾作為目標位置",
            "이동할 위치로 빈 폴더를 선택하십시오",
        ]))),
    }
}

fn check_open_target(state: &FolderState) -> AppResult<()> {
    match state {
        FolderState::Empty | FolderState::Guild => Ok(()),
        FolderState::IncompatibleGuild(reason) => Err(validation(reason)),
        FolderState::Foreign => Err(validation(locale::pick([
            "ギルドのデータフォルダではありません",
            "This is not a guild data folder",
            "这不是公会的数据文件夹",
            "這不是公會的資料資料夾",
            "길드의 데이터 폴더가 아닙니다",
        ]))),
    }
}

/// 選んだフォルダ（path）の問題
fn validation(message: &str) -> AppError {
    AppError::Validation(ValidationError::on("path", message))
}
