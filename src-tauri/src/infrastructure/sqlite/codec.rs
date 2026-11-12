//! 行と値の変換・エラーの対応づけ（リポジトリ共通）。

use guild_application::AppError;
use rusqlite::types::Type;
use rusqlite::Row;
use serde::de::DeserializeOwned;
use serde::Serialize;

use guild_domain::locale;

use super::database::DbError;

/// 値を JSON の文字列にする（配列・オブジェクトの列）
pub(super) fn to_json<T: Serialize>(value: &T) -> rusqlite::Result<String> {
    serde_json::to_string(value).map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
}

/// JSON の文字列の列を読む
pub(super) fn json_column<T: DeserializeOwned>(row: &Row<'_>, index: usize) -> rusqlite::Result<T> {
    let text: String = row.get(index)?;
    serde_json::from_str(&text)
        .map_err(|error| rusqlite::Error::FromSqlConversionFailure(index, Type::Text, Box::new(error)))
}

/// 列挙値の列を読む（未知の値は変換エラー）
pub(super) fn parsed_column<T>(row: &Row<'_>, index: usize, parse: impl Fn(&str) -> Option<T>) -> rusqlite::Result<T> {
    let text: String = row.get(index)?;
    parse(&text).ok_or_else(|| {
        let message = locale::pick([
            format!("未知の値です: {text}"),
            format!("Unknown value: {text}"),
            format!("未知的值：{text}"),
            format!("未知的值：{text}"),
            format!("알 수 없는 값입니다: {text}"),
        ]);
        rusqlite::Error::FromSqlConversionFailure(index, Type::Text, message.into())
    })
}

/// 一意制約の違反か（同じ名前のエージェント・スキル）
pub(super) fn is_unique_violation(error: &DbError) -> bool {
    matches!(
        error,
        DbError::Sqlite(rusqlite::Error::SqliteFailure(failure, _))
            if failure.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE
    )
}

pub(super) fn storage(error: DbError) -> AppError {
    AppError::Storage(error.to_string())
}
