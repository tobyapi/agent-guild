//! 実行の失敗。

/// ランナーが返した失敗の分類（protocol.ts の ErrorCode）。未知のコードは `Internal` に寄せる。
/// 中断はここに含めず `RunnerError::Cancelled` で表す。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCode {
    Auth,
    RateLimit,
    ModelNotFound,
    UnknownBackend,
    UnsupportedPermission,
    BadRequest,
    Internal,
}

#[derive(Debug, thiserror::Error)]
pub enum RunnerError {
    /// ランナーが使えない（起動中に ready にならなかった・起動失敗・版の不一致・停止済み）
    #[error("ランナーを使えません: {0}")]
    Unavailable(String),
    /// 実行中にランナーとの接続が切れた（異常終了など）
    #[error("ランナーとの接続が切れました")]
    Disconnected,
    /// cancel された（中断は失敗ではない）
    #[error("実行を中断しました")]
    Cancelled,
    #[error("{message}")]
    Backend { code: ErrorCode, message: String },
    #[error("プロトコルエラー: {0}")]
    Protocol(String),
}
