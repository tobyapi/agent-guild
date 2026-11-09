//! 子プロセスの stdout（イベント）と stderr（ログ）を読み続けるタスク。

use std::sync::Arc;

use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{ChildStderr, ChildStdout};
use tokio::sync::{oneshot, watch};

use crate::shared::Shared;
use crate::wire::{self, Event};

/// イベントを job_id ごとの待ち手へ配送する。stdout が閉じたら接続を閉じたことにする
pub(crate) async fn read_events(
    stdout: ChildStdout,
    shared: Arc<Shared>,
    ready: oneshot::Sender<wire::Ready>,
    closed: Arc<watch::Sender<bool>>,
) {
    let mut ready = Some(ready);
    for_each_line(stdout, |line| route(&shared, line.trim(), &mut ready)).await;
    closed.send_replace(true);
}

/// 子の stderr は常に読み、log に流す（読まないとパイプが詰まって子が止まる）
pub(crate) async fn log_stderr(stderr: ChildStderr) {
    for_each_line(stderr, |line| log::info!(target: "agent_runner", "{line}")).await;
}

/// 1行ずつ渡す。UTF-8 として壊れたバイトは置き換え、空行は飛ばす
async fn for_each_line(stream: impl AsyncRead + Unpin, mut handle: impl FnMut(&str)) {
    let mut reader = BufReader::new(stream);
    let mut buffer = Vec::new();
    loop {
        buffer.clear();
        match reader.read_until(b'\n', &mut buffer).await {
            Ok(0) => return,
            Ok(_) => {
                let line = String::from_utf8_lossy(&buffer);
                let line = line.trim_end();
                if !line.trim_start().is_empty() {
                    handle(line);
                }
            }
            Err(error) => {
                log::warn!("ランナーの出力を読めません: {error}");
                return;
            }
        }
    }
}

fn route(shared: &Shared, line: &str, ready: &mut Option<oneshot::Sender<wire::Ready>>) {
    match wire::parse_event(line) {
        Ok(Event::Ready(event)) => match ready.take() {
            Some(ready) => {
                let _ = ready.send(event);
            }
            None => log::warn!("2回目の ready を無視しました"),
        },
        Ok(Event::Backends { backends }) => {
            shared.backends.send_replace(backends);
        }
        Ok(Event::Activity { id, detail }) => shared.jobs.activity(&id, detail),
        Ok(Event::Result { id, text }) => {
            shared.jobs.finish(&id, Ok(text));
        }
        Ok(Event::Error { id: Some(id), code, message }) => {
            shared.jobs.finish(&id, Err(wire::runner_error(&code, message)));
        }
        Ok(Event::Error { id: None, code, message }) => log::warn!("ランナーのエラー（{code}）: {message}"),
        Ok(Event::Unknown) => log::debug!("未知のイベントを無視しました: {line}"),
        Err(error) => log::warn!("解釈できない行を無視しました（{error}）: {line}"),
    }
}
