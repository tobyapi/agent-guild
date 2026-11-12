//! データフォルダとマシンごとの設定のポート（保存先の変更・復旧モード・スキルライブラリで使う）。

use std::path::{Path, PathBuf};

use guild_domain::locale::Language;

use crate::error::AppResult;

/// 移動先のフォルダの中身
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FolderState {
    /// 存在しないか空
    Empty,
    /// ギルドのデータフォルダで、この版で開ける
    Guild,
    /// ギルドのデータフォルダだが、この版では開けない（理由。使用者向けの日本語）
    IncompatibleGuild(String),
    /// ギルドのデータではないファイルがある
    Foreign,
}

/// 移動先の候補を調べた結果
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TargetFolder {
    pub state: FolderState,
    /// いまのデータフォルダと同じ
    pub is_current: bool,
    /// いまのデータフォルダと入れ子になっている
    pub is_nested: bool,
    /// 既定のデータフォルダ（settings.json には null と書く）
    pub is_default: bool,
}

/// フォルダの調査とファイラ
pub trait Folders: Send + Sync {
    /// 移動先の候補を調べる。書き込めなければ Validation（試しにファイルを作って消す）
    fn inspect(&self, dir: &Path) -> AppResult<TargetFolder>;
    /// OS のファイラで開く
    fn reveal(&self, dir: &Path) -> AppResult<()>;
}

/// 今のデータの書き出し（保存先の変更の copy）
pub trait DataExporter: Send + Sync {
    /// 空のフォルダ dir に、DB（VACUUM INTO）・agents/・guild-data.json を書き出す。
    /// 失敗したら dir に作った一時ファイルを消してから Storage を返す
    fn export_to(&self, dir: &Path) -> AppResult<()>;
}

/// マシンごとの設定（settings.json）のうちアプリが読み書きする項目。未知のフィールドは実装が保持する
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LaunchSettings {
    /// None なら既定のデータフォルダ
    pub data_dir: Option<PathBuf>,
    /// スキルライブラリのフォルダ（使用者が並べた順）
    pub skill_library_dirs: Vec<PathBuf>,
    /// 初回起動の初期設定（名前・スキルのフォルダ・データの保存先）を終えた
    pub setup_done: bool,
    /// 表示とエージェントの会話の言語（None = まだ選んでいない。日本語として扱う）
    pub language: Option<Language>,
}

pub trait SettingsStore: Send + Sync {
    fn load(&self) -> AppResult<LaunchSettings>;
    /// version が新しすぎるファイルは書き換えずに Storage を返す
    fn save(&self, settings: &LaunchSettings) -> AppResult<()>;
}
