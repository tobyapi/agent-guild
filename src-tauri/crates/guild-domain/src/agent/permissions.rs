//! 権限（protocol.ts・TS の Permissions）と実効権限の計算。
//! 権限は役割だけで決まり（Agent::behavior().permissions）、ランナーにもそのまま渡す。実効権限は、そのうち
//! エージェントのバックエンドが実際に使える操作で、プロンプトの「できること」と画面の表示に使う。

use serde::{Deserialize, Serialize};

use super::{usable_permissions, Agent};
use crate::backend::BackendInfo;

/// 権限の名前（TS の PermissionKey）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionKey {
    WebSearch,
    WebFetch,
    ReadFiles,
    ReadAnywhere,
    WriteFiles,
    WriteAnywhere,
    RunCommands,
    Skills,
}

impl PermissionKey {
    /// 使用者に見せる名前（React の PERMISSION_LABELS と同じ）
    pub fn label(self) -> &'static str {
        match self {
            Self::WebSearch => "Web 検索",
            Self::WebFetch => "Web ページを読む",
            Self::ReadFiles => "ファイルを読む",
            Self::ReadAnywhere => "作業フォルダの外も読む",
            Self::WriteFiles => "ファイルを書く",
            Self::WriteAnywhere => "作業フォルダの外にも書く",
            Self::RunCommands => "コマンドを実行",
            Self::Skills => "スキルを使う",
        }
    }
}

/// 各権限を許すか（TS の Record<PermissionKey, boolean>）
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    pub web_search: bool,
    pub web_fetch: bool,
    pub read_files: bool,
    #[serde(default)]
    pub read_anywhere: bool,
    pub write_files: bool,
    pub write_anywhere: bool,
    pub run_commands: bool,
    pub skills: bool,
}

impl Permissions {
    pub fn get(&self, key: PermissionKey) -> bool {
        match key {
            PermissionKey::WebSearch => self.web_search,
            PermissionKey::WebFetch => self.web_fetch,
            PermissionKey::ReadFiles => self.read_files,
            PermissionKey::ReadAnywhere => self.read_anywhere,
            PermissionKey::WriteFiles => self.write_files,
            PermissionKey::WriteAnywhere => self.write_anywhere,
            PermissionKey::RunCommands => self.run_commands,
            PermissionKey::Skills => self.skills,
        }
    }

    pub fn allow(&mut self, key: PermissionKey) {
        self.set(key, true);
    }

    pub fn deny(&mut self, key: PermissionKey) {
        self.set(key, false);
    }

    fn set(&mut self, key: PermissionKey, value: bool) {
        let slot = match key {
            PermissionKey::WebSearch => &mut self.web_search,
            PermissionKey::WebFetch => &mut self.web_fetch,
            PermissionKey::ReadFiles => &mut self.read_files,
            PermissionKey::ReadAnywhere => &mut self.read_anywhere,
            PermissionKey::WriteFiles => &mut self.write_files,
            PermissionKey::WriteAnywhere => &mut self.write_anywhere,
            PermissionKey::RunCommands => &mut self.run_commands,
            PermissionKey::Skills => &mut self.skills,
        };
        *slot = value;
    }

    /// 両方で許されている権限だけ
    pub fn intersect(self, other: Permissions) -> Permissions {
        Permissions {
            web_search: self.web_search && other.web_search,
            web_fetch: self.web_fetch && other.web_fetch,
            read_files: self.read_files && other.read_files,
            read_anywhere: self.read_anywhere && other.read_anywhere,
            write_files: self.write_files && other.write_files,
            write_anywhere: self.write_anywhere && other.write_anywhere,
            run_commands: self.run_commands && other.run_commands,
            skills: self.skills && other.skills,
        }
    }
}

/// 役割の権限のうち、このエージェントのバックエンドが実際に使える操作（役割の権限を超えない）。
/// 保存済みの個別権限には依存しない。
pub fn effective_permissions(agent: &Agent, backend: Option<&BackendInfo>) -> Permissions {
    if agent.backend == "ollama" && !ollama_tools_enabled(&agent.backend_options, &agent.model, backend) {
        return Permissions::default();
    }
    usable_permissions(agent.behavior().permissions, backend)
}

/// 保存値がない既存エージェントは会話専用のまま。能力が不明なモデルも拒否する。
pub(super) fn ollama_tools_enabled(
    options: &serde_json::Map<String, serde_json::Value>,
    model: &str,
    backend: Option<&BackendInfo>,
) -> bool {
    options.get("enableTools").and_then(serde_json::Value::as_bool) == Some(true)
        && backend.and_then(|info| info.model_spec(model)).and_then(|spec| spec.tools) == Some(true)
}
