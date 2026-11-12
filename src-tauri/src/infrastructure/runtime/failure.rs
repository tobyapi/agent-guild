//! runner-client の失敗を、ポートの失敗（いまの言語の文面）にする。
//! runner-client の Display はログ用の日本語なので、利用者に見せる文面はここで選ぶ。

use guild_application::ports::RuntimeError;
use guild_domain::locale;
use runner_client::RunnerError;

/// 中断は独立に、それ以外はいまの言語のメッセージの失敗として返す
pub(super) fn error(error: RunnerError) -> RuntimeError {
    let message = match error {
        RunnerError::Cancelled => return RuntimeError::Cancelled,
        RunnerError::Unavailable(reason) => locale::pick([
            format!("ランナーを使えません: {reason}"),
            format!("The agent runtime is unavailable: {reason}"),
            format!("运行环境不可用：{reason}"),
            format!("執行環境無法使用：{reason}"),
            format!("실행 환경을 사용할 수 없습니다: {reason}"),
        ]),
        RunnerError::Disconnected => locale::pick([
            "ランナーとの接続が切れました",
            "Lost the connection to the agent runtime",
            "与运行环境的连接已断开",
            "與執行環境的連線已中斷",
            "실행 환경과의 연결이 끊어졌습니다",
        ])
        .to_owned(),
        RunnerError::Backend { message, .. } => message,
        RunnerError::Protocol(detail) => locale::pick([
            format!("プロトコルエラー: {detail}"),
            format!("Protocol error: {detail}"),
            format!("协议错误：{detail}"),
            format!("協定錯誤：{detail}"),
            format!("프로토콜 오류: {detail}"),
        ]),
    };
    RuntimeError::Failed(message)
}
