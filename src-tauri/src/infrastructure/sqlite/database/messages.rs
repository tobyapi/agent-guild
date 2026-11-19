//! データベースを開けない・操作できないときに使用者に見せる文面（いまの言語。docs/i18n.md）。

use std::fmt::Display;

use guild_domain::locale;

pub(super) fn sqlite_failed(error: &impl Display) -> String {
    locale::pick([
        format!("データベースの操作に失敗しました: {error}"),
        format!("A database operation failed: {error}"),
        format!("数据库操作失败：{error}"),
        format!("資料庫操作失敗：{error}"),
        format!("데이터베이스 작업에 실패했습니다: {error}"),
    ])
}

pub(super) fn io_failed(error: &impl Display) -> String {
    locale::pick([
        format!("データベースのファイル操作に失敗しました: {error}"),
        format!("A database file operation failed: {error}"),
        format!("数据库文件操作失败：{error}"),
        format!("資料庫檔案操作失敗：{error}"),
        format!("데이터베이스 파일 작업에 실패했습니다: {error}"),
    ])
}

pub(super) fn foreign() -> &'static str {
    locale::pick([
        "AIギルドのデータベースではありません",
        "This is not an AI Guild database",
        "这不是 AI 公会的数据库",
        "這不是 AI 公會的資料庫",
        "AI 길드의 데이터베이스가 아닙니다",
    ])
}

pub(super) fn newer(version: &usize) -> String {
    locale::pick([
        format!("新しい版のアプリで保存されたデータベースです（スキーマの版 {version}）"),
        format!("This database was saved by a newer version of the app (schema version {version})"),
        format!("此数据库由较新版本的应用保存（架构版本 {version}）"),
        format!("此資料庫由較新版本的應用程式儲存（結構描述版本 {version}）"),
        format!("새 버전의 앱으로 저장된 데이터베이스입니다(스키마 버전 {version})"),
    ])
}

pub(super) fn corrupt(reason: &str) -> String {
    locale::pick([
        format!("データベースを読み込めません: {reason}"),
        format!("Cannot load the database: {reason}"),
        format!("无法读取数据库：{reason}"),
        format!("無法讀取資料庫：{reason}"),
        format!("데이터베이스를 읽을 수 없습니다: {reason}"),
    ])
}

pub(in crate::infrastructure::sqlite) fn fingerprint_mismatch() -> String {
    locale::pick([
        "スキーマの指紋が一致しません",
        "The schema fingerprint does not match",
        "架构指纹不一致",
        "結構描述指紋不一致",
        "스키마 지문이 일치하지 않습니다",
    ])
    .to_owned()
}

pub(super) fn needs_028() -> &'static str {
    locale::pick([
        "このフォルダを v0.1.28 で一度開いて終了してから、再試行してください。",
        "Open this folder in v0.1.28, close it, then try again.",
        "请先用 v0.1.28 打开此文件夹并退出，再重试。",
        "請先用 v0.1.28 開啟此資料夾並結束，再重試。",
        "v0.1.28에서 이 폴더를 열고 종료한 뒤 다시 시도하세요.",
    ])
}
pub(super) fn conversion_stopped(reason: &str) -> String {
    locale::pick([
        format!("データの変換を完了できませんでした。{reason}"),
        format!("Data conversion could not finish. {reason}"),
        format!("数据转换未能完成。{reason}"),
        format!("資料轉換未能完成。{reason}"),
        format!("데이터 변환을 완료하지 못했습니다. {reason}"),
    ])
}
