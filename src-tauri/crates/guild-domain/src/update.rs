//! アプリの更新（自動アップデート。design.md「アプリの更新」）の確認結果。

use serde::{Deserialize, Serialize};

/// いまの版と、あれば新しい版（TS の UpdateStatus）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    /// いま動いているアプリの版（例: "0.1.0"）
    pub current_version: String,
    /// いまより新しい版。なければ None（最新）
    pub latest: Option<AvailableUpdate>,
}

/// 入れられる新しい版（TS の AvailableUpdate）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableUpdate {
    pub version: String,
    /// リリースの説明（なければ空）
    pub notes: String,
}
