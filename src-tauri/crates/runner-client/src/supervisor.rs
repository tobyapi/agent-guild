//! 監視タスク: ランナーを起動して ready を待ち、落ちたらバックオフ付きで起動し直す（同時に1つ）。
//! 状態（`RunnerStatus`）とバックエンド一覧を公開する。

use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::watch;

use crate::connection::Connection;
use crate::shared::Shared;
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
                "ランナーが終了しました".to_owned()
            }
            Err(error) => error.to_string(),
        };
        if shared.is_closing() {
            break;
        }
        log::warn!("{reason}。{} ミリ秒後に起動し直します", backoff.as_millis());
        shared.status.send_replace(RunnerStatus::Unavailable {
            message: format!("{reason}（自動で起動し直します）")
        });
        tokio::select! {
            () = tokio::time::sleep(backoff) => {}
            _ = closing.wait_for(|closing| *closing) => {}
        }
        backoff = (backoff * 2).min(MAX_BACKOFF);
    }
    shared.status.send_replace(RunnerStatus::Unavailable { message: "ランナーを停止しました".to_owned() });
}

/// ready の間、接続を公開して終了を待つ。shutdown による終了なら接続の後始末は shutdown() に任せる
async fn serve(
    shared: &Shared,
    connection: Arc<Connection>,
    backends: Vec<BackendInfo>,
    closing: &mut watch::Receiver<bool>,
) {
    shared.set_current(Arc::clone(&connection));
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
