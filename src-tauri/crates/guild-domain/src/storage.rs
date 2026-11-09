//! データフォルダ（guild.db と agents/ を置く場所）の情報と、保存先変更のしかた。

use serde::{Deserialize, Serialize};

/// データフォルダがどこで決まったか（環境変数 > settings.json > 既定）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StorageSource {
    Default,
    Settings,
    Env,
}

/// TS の StorageInfo
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    /// いま使っているデータフォルダ
    pub data_dir: String,
    pub default_data_dir: String,
    pub source: StorageSource,
}

/// 保存先変更のしかた（TS の DataDirMode）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DataDirMode {
    /// 今のデータを空のフォルダにコピーして使う（元のデータは消さない）
    Copy,
    /// その場所のデータを開く（空なら新規データとして初期化される）
    Open,
}
