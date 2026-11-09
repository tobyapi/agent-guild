//! ドメインの検証エラーと、コマンドが失敗時に返す値の形（TS の CommandError）。

use std::fmt;

use serde::{Deserialize, Serialize};

/// 入力がドメインの規則に合わないときのエラー。メッセージは使用者にそのまま見せる日本語。
/// field はどの入力のことか（コマンドの入力の camelCase のキー。例: "name"・"autonomyIntervalMin"）。
/// 特定の入力に結びつかないときは None（React はフォームの先頭に出す）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationError {
    message: String,
    field: Option<&'static str>,
}

impl ValidationError {
    /// 特定の入力に結びつかない検証エラー
    pub fn new(message: impl Into<String>) -> Self {
        Self { message: message.into(), field: None }
    }

    /// 入力 field についての検証エラー
    pub fn on(field: &'static str, message: impl Into<String>) -> Self {
        Self { message: message.into(), field: Some(field) }
    }

    pub fn message(&self) -> &str {
        &self.message
    }

    pub fn field(&self) -> Option<&'static str> {
        self.field
    }
}

impl fmt::Display for ValidationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for ValidationError {}

/// エラーの分類（TS の ErrorCode）。React はこれで分岐する
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    NotFound,
    Validation,
    Conflict,
    Storage,
    Runtime,
    /// いまは使えない（復旧モード・保存先の変更中など）
    Unavailable,
    Internal,
}

/// すべてのコマンドが失敗時に reject する値（message は日本語）。
/// field は validation のとき、どの入力のことか（分からなければ null）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
    pub field: Option<String>,
}

impl CommandError {
    /// 入力に結びつかない失敗
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), field: None }
    }
}

/// 文字数（バイト数ではない）が上限以内か確かめる。超えたら入力 field についての検証エラー
pub(crate) fn ensure_max_chars(
    value: &str,
    max: usize,
    field: &'static str,
    message: &str,
) -> Result<(), ValidationError> {
    if value.chars().count() > max {
        Err(ValidationError::on(field, message))
    } else {
        Ok(())
    }
}
