//! 作業フォルダの検証と操作の失敗で使用者に見せる文面（いまの言語。docs/i18n.md）。

use std::fmt::Display;

use guild_domain::locale;

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
