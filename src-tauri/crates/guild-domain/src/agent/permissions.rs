//! 権限（protocol.ts・TS の Permissions）と実効権限の計算。
//! 権限は役割だけで決まり（Agent::behavior().permissions）、ランナーにもそのまま渡す。実効権限は、そのうち
//! エージェントのバックエンドが実際に使える操作で、プロンプトの「できること」と画面の表示に使う。

use serde::{Deserialize, Serialize};

use super::{usable_permissions, Agent};
use crate::backend::BackendInfo;
use crate::locale;

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
        locale::pick(match self {
            Self::WebSearch => ["Web 検索", "Web search", "网络搜索", "網路搜尋", "웹 검색"],
            Self::WebFetch => ["Web ページを読む", "Read web pages", "读取网页", "讀取網頁", "웹 페이지 읽기"],
            Self::ReadFiles => ["ファイルを読む", "Read files", "读取文件", "讀取檔案", "파일 읽기"],
            Self::ReadAnywhere => [
                "作業フォルダの外も読む",
                "Read outside the workspace",
                "读取工作区以外的内容",
                "讀取工作區以外的內容",
                "작업 공간 밖도 읽기",
            ],
            Self::WriteFiles => ["ファイルを書く", "Write files", "写入文件", "寫入檔案", "파일 쓰기"],
            Self::WriteAnywhere => [
                "作業フォルダの外にも書く",
                "Write outside the workspace",
                "写入工作区以外的位置",
                "寫入工作區以外的位置",
                "작업 공간 밖에도 쓰기",
            ],
            Self::RunCommands => ["コマンドを実行", "Run commands", "执行命令", "執行命令", "명령 실행"],
            Self::Skills => ["スキルを使う", "Use skills", "使用技能", "使用技能", "스킬 사용"],
        })
    }
}

/// 各権限を許すか（TS の Record<PermissionKey, boolean>）
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    pub web_search: bool,
    pub web_fetch: bool,
    pub read_files: bool,
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
    // 道具の利用を切り替えるバックエンドでは、有効にしていて、モデルが道具に対応しているときだけ使える（それまでは会話専用）
    if backend.is_some_and(|info| !info.tools_enabled(&agent.backend_options, &agent.model)) {
        return Permissions::default();
    }
    usable_permissions(agent.behavior().permissions, backend)
}
