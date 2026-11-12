//! BackendInfo のうち、指定フォルダの範囲の守り方とアプリからのセットアップ（`agent-runner/src/protocol.ts` と同じ JSON）。

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// 指定フォルダの範囲の守り方
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FolderScope {
    /// ファイルの道具ごとに範囲を確かめる。コマンドとスキルは確認をすり抜けるので使えない
    Files,
    /// シェルごと OS の隔離に入れる。コマンドも範囲の中で使える
    Sandbox,
}

/// アプリからのセットアップのうち、このバックエンドでできること
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendSetup {
    /// 使えない（unavailable）ときに出す、CLI のインストールの案内
    pub install: Option<InstallGuide>,
    /// 止まっている（stopped）ときに、アプリから起動できる
    pub start: Option<StartSpec>,
    /// アプリからログインを始められる（login 要求を受け付ける）
    pub login: Option<LoginSpec>,
    /// アプリに API キーを保存できる（apiKey 要求を受け付ける）
    pub api_key: Option<ApiKeySpec>,
}

/// CLI の公式インストーラー（macOS・Linux 用のシェルスクリプト）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallGuide {
    /// 入れる CLI の名前（例: 「Claude Code」）
    pub cli: String,
    pub publisher: String,
    /// インストーラーの URL（https）
    pub script_url: String,
    /// インストーラーを実行するシェル（絶対パス）
    pub shell: String,
    /// 入る実行ファイルの名前（~/.local/bin の中）
    pub binary: String,
    /// インストーラーに渡す環境変数。値の `{bin}` はインストール先に置き換える
    pub env: BTreeMap<String, String>,
    pub docs_url: String,
    pub login_command: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSpec {
    /// 起動する macOS のアプリ（bundle ID）
    pub mac_bundle_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginSpec {
    /// ログインのボタンの文言
    pub label: String,
    /// ログインを待っている間の案内
    pub waiting: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeySpec {
    /// 保存したキーがないときに使う環境変数の名前
    pub env_var: String,
}
