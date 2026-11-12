//! ユースケースのエラー。コマンドの失敗（CommandError { code, message, field }）にそのまま対応する。

use guild_domain::error::{CommandError, ErrorCode, ValidationError};
use guild_domain::locale;

pub type AppResult<T> = Result<T, AppError>;

/// メッセージは使用者にそのまま見せる文面（いまの言語。docs/i18n.md）
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum AppError {
    /// 対象（「エージェント」など）が見つからない
    #[error("{}", not_found(.0))]
    NotFound(&'static str),
    /// 入力の問題（どの入力のことかを持てる）
    #[error("{0}")]
    Validation(ValidationError),
    #[error("{0}")]
    Conflict(String),
    #[error("{}", storage_failed(.0))]
    Storage(String),
    #[error("{0}")]
    Runtime(String),
    /// いまは使えない（復旧モード・保存先の変更中など）
    #[error("{0}")]
    Unavailable(String),
    #[error("{}", internal(.0))]
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

/// NotFound に渡す、よく使う対象の名前（いまの言語）
pub mod subject {
    use guild_domain::locale;

    pub fn agent() -> &'static str {
        locale::pick(["エージェント", "Agent", "智能体", "代理人", "에이전트"])
    }
}

fn not_found(subject: &str) -> String {
    locale::pick([
        format!("{subject}が見つかりません"),
        format!("{subject} not found"),
        format!("找不到{subject}"),
        format!("找不到{subject}"),
        format!("{subject}을(를) 찾을 수 없습니다"),
    ])
}

fn storage_failed(detail: &str) -> String {
    locale::pick([
        format!("データの保存・読み込みに失敗しました: {detail}"),
        format!("Failed to save or load data: {detail}"),
        format!("数据保存或读取失败：{detail}"),
        format!("資料儲存或讀取失敗：{detail}"),
        format!("데이터 저장 또는 읽기에 실패했습니다: {detail}"),
    ])
}

fn internal(detail: &str) -> String {
    locale::pick([
        format!("内部エラーが起きました: {detail}"),
        format!("An internal error occurred: {detail}"),
        format!("发生内部错误：{detail}"),
        format!("發生內部錯誤：{detail}"),
        format!("내부 오류가 발생했습니다: {detail}"),
    ])
}

impl From<ValidationError> for AppError {
    fn from(error: ValidationError) -> Self {
        Self::Validation(error)
    }
}
