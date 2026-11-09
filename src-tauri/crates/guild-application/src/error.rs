//! ユースケースのエラー。コマンドの失敗（CommandError { code, message, field }）にそのまま対応する。

use guild_domain::error::{CommandError, ErrorCode, ValidationError};

pub type AppResult<T> = Result<T, AppError>;

/// メッセージは使用者にそのまま見せる日本語
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum AppError {
    /// 対象（「エージェント」など）が見つからない
    #[error("{0}が見つかりません")]
    NotFound(&'static str),
    /// 入力の問題（どの入力のことかを持てる）
    #[error("{0}")]
    Validation(ValidationError),
    #[error("{0}")]
    Conflict(String),
    #[error("データの保存・読み込みに失敗しました: {0}")]
    Storage(String),
    #[error("{0}")]
    Runtime(String),
    /// いまは使えない（復旧モード・保存先の変更中など）
    #[error("{0}")]
    Unavailable(String),
    #[error("内部エラーが起きました: {0}")]
    Internal(String),
}

impl AppError {
    pub fn code(&self) -> ErrorCode {
        match self {
            Self::NotFound(_) => ErrorCode::NotFound,
            Self::Validation(_) => ErrorCode::Validation,
            Self::Conflict(_) => ErrorCode::Conflict,
            Self::Storage(_) => ErrorCode::Storage,
            Self::Runtime(_) => ErrorCode::Runtime,
            Self::Unavailable(_) => ErrorCode::Unavailable,
            Self::Internal(_) => ErrorCode::Internal,
        }
    }

    /// 特定の入力に結びつかない検証エラー
    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation(ValidationError::new(message))
    }

    pub fn to_command_error(&self) -> CommandError {
        let field = match self {
            Self::Validation(error) => error.field().map(str::to_owned),
            _ => None,
        };
        CommandError { code: self.code(), message: self.to_string(), field }
    }
}

impl From<ValidationError> for AppError {
    fn from(error: ValidationError) -> Self {
        Self::Validation(error)
    }
}
