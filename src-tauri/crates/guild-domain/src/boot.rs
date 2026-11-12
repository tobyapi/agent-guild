//! 起動の結果（通常か復旧モードか）。復旧モードではサービスを起動せず、React が復旧画面を出す。

use serde::{Deserialize, Serialize};

use crate::locale::Language;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BootState {
    Ok,
    Recovery,
}

/// 復旧モードの理由（TS の BootReason）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BootReason {
    None,
    /// 設定や環境変数で指定されたデータフォルダがない
    Missing,
    /// 別のアプリ（多重起動）がデータフォルダを使っている
    Locked,
    /// 新しい版のアプリが作ったデータ
    NewerVersion,
    /// ギルドのデータではない
    Foreign,
    /// データベースが壊れている
    Corrupt,
    NotWritable,
}

/// TS の BootStatus
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootStatus {
    pub state: BootState,
    pub reason: BootReason,
    pub data_dir: String,
    pub message: String,
    /// 初回起動の初期設定（名前・スキルのフォルダ・データの保存先）がまだ（React が初期設定のダイアログを出す）
    pub needs_setup: bool,
    /// settings.json に保存した言語（まだ選んでいなければ null。React は OS の言語を使う）
    #[serde(default)]
    pub language: Option<Language>,
}

impl BootStatus {
    pub fn ok(data_dir: impl Into<String>, needs_setup: bool) -> Self {
        Self {
            state: BootState::Ok,
            reason: BootReason::None,
            data_dir: data_dir.into(),
            message: String::new(),
            needs_setup,
            language: None,
        }
    }

    pub fn recovery(reason: BootReason, data_dir: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            state: BootState::Recovery,
            reason,
            data_dir: data_dir.into(),
            message: message.into(),
            needs_setup: false,
            language: None,
        }
    }

    /// 保存した言語を添える
    pub fn with_language(self, language: Option<Language>) -> Self {
        Self { language, ..self }
    }

    pub fn is_ok(&self) -> bool {
        self.state == BootState::Ok
    }
}
