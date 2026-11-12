//! 作業フォルダの検証と操作の失敗で使用者に見せる文面（いまの言語。docs/i18n.md）。

use std::fmt::Display;

use guild_domain::locale;

pub(super) fn not_absolute() -> &'static str {
    locale::pick([
        "作業フォルダは絶対パスで指定してください",
        "Specify the workspace folder as an absolute path",
        "请使用绝对路径指定工作文件夹",
        "請使用絕對路徑指定工作資料夾",
        "작업 폴더는 절대 경로로 지정하십시오",
    ])
}

pub(super) fn not_existing() -> &'static str {
    locale::pick([
        "存在するフォルダを指定してください",
        "Specify a folder that exists",
        "请指定存在的文件夹",
        "請指定存在的資料夾",
        "존재하는 폴더를 지정하십시오",
    ])
}

pub(super) fn no_storage_parent() -> &'static str {
    locale::pick([
        "保存領域の親がありません",
        "The app storage area has no parent folder",
        "存储区域没有上级文件夹",
        "儲存區域沒有上層資料夾",
        "저장 영역의 상위 폴더가 없습니다",
    ])
}

pub(super) fn managed_folder() -> &'static str {
    locale::pick([
        "アプリの保存領域やその親フォルダは割り当てられません",
        "The app's storage area and its parent folders cannot be assigned",
        "不能指定应用的存储区域或其上级文件夹",
        "不能指定應用程式的儲存區域或其上層資料夾",
        "앱의 저장 영역이나 그 상위 폴더는 지정할 수 없습니다",
    ])
}

pub(super) fn unreadable_path() -> &'static str {
    locale::pick([
        "フォルダのパスを読み取れません",
        "Cannot read the folder path",
        "无法读取文件夹路径",
        "無法讀取資料夾路徑",
        "폴더 경로를 읽을 수 없습니다",
    ])
}

pub(super) fn folder_changed() -> &'static str {
    locale::pick([
        "割り当てフォルダの実体が変わりました。選び直してください",
        "The assigned folder has changed. Choose it again",
        "指定的文件夹已发生变化。请重新选择",
        "指定的資料夾已變更。請重新選擇",
        "지정한 폴더의 실체가 바뀌었습니다. 다시 선택하십시오",
    ])
}

pub(super) fn no_workspace_parent() -> &'static str {
    locale::pick([
        "作業場所の親がありません",
        "The workspace has no parent folder",
        "工作区没有上级文件夹",
        "工作區沒有上層資料夾",
        "작업 공간의 상위 폴더가 없습니다",
    ])
}

pub(super) fn cannot_reveal(error: &impl Display) -> String {
    locale::pick([
        format!("フォルダを開けませんでした（{error}）"),
        format!("Could not open the folder ({error})"),
        format!("无法打开文件夹（{error}）"),
        format!("無法開啟資料夾（{error}）"),
        format!("폴더를 열 수 없습니다({error})"),
    ])
}

pub(super) fn operation_failed(error: &impl Display) -> String {
    locale::pick([
        format!("作業フォルダを操作できませんでした: {error}"),
        format!("Could not access the workspace folder: {error}"),
        format!("无法操作工作文件夹：{error}"),
        format!("無法操作工作資料夾：{error}"),
        format!("작업 폴더를 조작할 수 없습니다: {error}"),
    ])
}
