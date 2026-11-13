//! 監視タスク: ランナーを起動して ready を待ち、落ちたらバックオフ付きで起動し直す（同時に1つ）。
//! 状態（`RunnerStatus`）とバックエンド一覧を公開する。

use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::watch;

use crate::connection::Connection;
use crate::shared::Shared;
use crate::wire::Request;
use crate::{BackendInfo, RunnerStatus};

const INITIAL_BACKOFF: Duration = Duration::from_millis(250);
const MAX_BACKOFF: Duration = Duration::from_secs(30);
/// これより長く動いていたら、次の再起動の待ち時間を初期値に戻す
const STABLE_AFTER: Duration = Duration::from_secs(10);
/// shutdown を送ってから kill するまでの猶予
const SHUTDOWN_GRACE: Duration = Duration::from_secs(5);

pub(crate) async fn supervise(shared: Arc<Shared>) {
    let mut closing = shared.closing.subscribe();
    let mut backoff = INITIAL_BACKOFF;
    while !shared.is_closing() {
        shared.status.send_replace(RunnerStatus::Starting);
        let started = Instant::now();
        let reason = match Connection::open(&shared).await {
            Ok((connection, backends)) => {
                serve(&shared, connection, backends, &mut closing).await;
                if started.elapsed() >= STABLE_AFTER {
                    backoff = INITIAL_BACKOFF;
                }
                let exited = [
                    "ランナーが終了しました",
                    "The agent runtime exited",
                    "运行环境已退出",
                    "執行環境已結束",
                    "실행 환경이 종료되었습니다",
                ];
                shared.pick(exited).to_owned()
            }
            Err(error) => error.message(&shared.language()),
        };
        if shared.is_closing() {
            break;
        }
        log::warn!("{reason}。{} ミリ秒後に起動し直します", backoff.as_millis());
        let message = shared.pick([
            format!("{reason}（自動で起動し直します）"),
            format!("{reason} (restarting automatically)"),
            format!("{reason}（将自动重新启动）"),
            format!("{reason}（將自動重新啟動）"),
            format!("{reason} (자동으로 다시 시작합니다)"),
        ]);
        shared.status.send_replace(RunnerStatus::Unavailable { message });
        tokio::select! {
            () = tokio::time::sleep(backoff) => {}
            _ = closing.wait_for(|closing| *closing) => {}
        }
        backoff = (backoff * 2).min(MAX_BACKOFF);
    }
    let stopped = shared.pick([
        "ランナーを停止しました",
        "The agent runtime was stopped",
        "运行环境已停止",
        "執行環境已停止",
        "실행 환경을 중지했습니다",
    ]);
    shared.status.send_replace(RunnerStatus::Unavailable { message: stopped.to_owned() });
}

/// ready の間、接続を公開して終了を待つ。shutdown による終了なら接続の後始末は shutdown() に任せる
async fn serve(
    shared: &Shared,
    connection: Arc<Connection>,
    backends: Vec<BackendInfo>,
    closing: &mut watch::Receiver<bool>,
) {
    shared.set_current(Arc::clone(&connection));
    // 起動してから ready までに言語が変わっていたら伝える（set_language は ready の接続にしか送らない）
    let language = shared.language();
    if language != connection.language {
        let _ = connection.send(&Request::SetLanguage { language: &language }).await;
    }
    for (backend, mode) in shared.backend_auth_modes() {
        let id = format!("backend-auth-mode-init-{backend}");
        let _ = connection.send(&Request::BackendAuthMode { id: &id, backend: &backend, mode: &mode }).await;
    }
    shared.backends.send_replace(backends);
    shared.status.send_replace(RunnerStatus::Ready);
    let closed_by_itself = tokio::select! {
        () = connection.closed() => true,
        _ = closing.wait_for(|closing| *closing) => false,
    };
    if closed_by_itself {
        shared.backends.send_replace(Vec::new());
        shared.clear_current(&connection);
    }
}

/// 以後の再起動を止め、ランナーに shutdown を送って終了させる（猶予を過ぎたら kill）
pub(crate) async fn shutdown(shared: &Shared) {
    shared.closing.send_replace(true);
    let current = shared.take_current();
    shared.backends.send_replace(Vec::new());
    if let Some(connection) = current {
        connection.shutdown(SHUTDOWN_GRACE).await;
    }
}
