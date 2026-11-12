//! ランナーの子プロセス1つ分: 起動・ready の握手・1行の送信・終了の検知・停止。
//! 接続（`Connection`）が捨てられたら子プロセスも kill する。

use std::sync::Arc;
use std::time::Duration;

use tokio::io::AsyncWriteExt;
use tokio::process::{Child, ChildStdin};
use tokio::sync::{oneshot, watch, Mutex};

use crate::shared::Shared;
use crate::wire::{self, Request};
use crate::{launch, reader, BackendInfo, RunnerError, PROTOCOL_VERSION};

/// 起動の失敗。`message` がそのまま `RunnerStatus::Unavailable` の理由になる（Display はログ用の日本語）
#[derive(Debug, thiserror::Error)]
pub(crate) enum StartError {
    #[error("ランナーを起動できませんでした: {0}")]
    Spawn(#[source] std::io::Error),
    #[error("ランナーの標準入出力を開けませんでした")]
    Pipes,
    #[error("ランナーの起動待ちがタイムアウトしました")]
    ReadyTimeout,
    #[error("ランナーが ready を送る前に終了しました（ログを確認してください）")]
    Exited,
    #[error("ランナーのプロトコル版が合いません（期待 {expected}、実際 {actual}）")]
    VersionMismatch { expected: u32, actual: u32 },
    #[error("ランナーの ready が不正です: {0}")]
    Protocol(String),
}

impl StartError {
    /// 言語のコード language の文面
    pub(crate) fn message(&self, language: &str) -> String {
        let pick = |texts: [String; 5]| crate::text::pick(language, texts);
        match self {
            Self::Spawn(error) => pick([
                format!("ランナーを起動できませんでした: {error}"),
                format!("Could not start the agent runtime: {error}"),
                format!("无法启动运行环境：{error}"),
                format!("無法啟動執行環境：{error}"),
                format!("실행 환경을 시작할 수 없습니다: {error}"),
            ]),
            Self::Pipes => pick(owned([
                "ランナーの標準入出力を開けませんでした",
                "Could not open the agent runtime's standard input and output",
                "无法打开运行环境的标准输入输出",
                "無法開啟執行環境的標準輸入輸出",
                "실행 환경의 표준 입출력을 열 수 없습니다",
            ])),
            Self::ReadyTimeout => pick(owned([
                "ランナーの起動待ちがタイムアウトしました",
                "Timed out waiting for the agent runtime to start",
                "等待运行环境启动超时",
                "等待執行環境啟動逾時",
                "실행 환경 시작을 기다리다 시간이 초과되었습니다",
            ])),
            Self::Exited => pick(owned([
                "ランナーが ready を送る前に終了しました（ログを確認してください）",
                "The agent runtime exited before it was ready (check the log)",
                "运行环境在就绪前退出了（请查看日志）",
                "執行環境在就緒前結束了（請查看記錄）",
                "실행 환경이 준비되기 전에 종료되었습니다(로그를 확인하세요)",
            ])),
            Self::VersionMismatch { expected, actual } => pick([
                format!("ランナーのプロトコル版が合いません（期待 {expected}、実際 {actual}）"),
                format!("The agent runtime's protocol version does not match (expected {expected}, got {actual})"),
                format!("运行环境的协议版本不匹配（应为 {expected}，实际为 {actual}）"),
                format!("執行環境的協定版本不符（應為 {expected}，實際為 {actual}）"),
                format!("실행 환경의 프로토콜 버전이 맞지 않습니다(예상 {expected}, 실제 {actual})"),
            ]),
            Self::Protocol(error) => pick([
                format!("ランナーの ready が不正です: {error}"),
                format!("The agent runtime sent an invalid ready message: {error}"),
                format!("运行环境的就绪消息无效：{error}"),
                format!("執行環境的就緒訊息無效：{error}"),
                format!("실행 환경의 준비 메시지가 올바르지 않습니다: {error}"),
            ]),
        }
    }
}

fn owned(texts: [&str; 5]) -> [String; 5] {
    texts.map(str::to_owned)
}

pub(crate) struct Connection {
    /// 起動したときの言語（ready までに変わっていたら、ready のあとで setLanguage を送る）
    pub(crate) language: String,
    stdin: Mutex<ChildStdin>,
    closed: watch::Receiver<bool>,
    kill: parking_lot::Mutex<Option<oneshot::Sender<()>>>,
}

impl Connection {
    /// 子プロセスを起動し、ready を待って版を確かめる。成功したら申告されたバックエンド一覧も返す。
    pub(crate) async fn open(shared: &Arc<Shared>) -> Result<(Arc<Self>, Vec<BackendInfo>), StartError> {
        let language = shared.language();
        let mut child = launch::command(&shared.config, &language).spawn().map_err(StartError::Spawn)?;
        if let Some(job_object) = &shared.job_object {
            if let Err(error) = job_object.assign(&child) {
                log::warn!("ランナーをジョブオブジェクトに入れられませんでした: {error}");
            }
        }
        let (Some(stdin), Some(stdout), Some(stderr)) = (child.stdin.take(), child.stdout.take(), child.stderr.take())
        else {
            return Err(StartError::Pipes);
        };
        let closed = Arc::new(watch::Sender::new(false));
        let (ready_tx, ready_rx) = oneshot::channel();
        let (kill_tx, kill_rx) = oneshot::channel();
        tokio::spawn(reader::read_events(stdout, Arc::clone(shared), ready_tx, Arc::clone(&closed)));
        tokio::spawn(reader::log_stderr(stderr));
        let closed_rx = closed.subscribe();
        tokio::spawn(watch_process(child, kill_rx, closed));
        let connection = Arc::new(Self {
            language,
            stdin: Mutex::new(stdin),
            closed: closed_rx,
            kill: parking_lot::Mutex::new(Some(kill_tx)),
        });
        // 失敗したら connection が捨てられ、子プロセスは kill される
        let backends = handshake(ready_rx, shared.config.ready_timeout).await?;
        Ok((connection, backends))
    }

    /// 1行送る（行どうしが混ざらないよう stdin のロックの中で書く）
    pub(crate) async fn send(&self, request: &Request<'_>) -> Result<(), RunnerError> {
        let line = request.to_line()?;
        let mut stdin = self.stdin.lock().await;
        let written = async {
            stdin.write_all(line.as_bytes()).await?;
            stdin.flush().await
        };
        written.await.map_err(|error| {
            log::debug!("ランナーへの送信に失敗しました: {error}");
            RunnerError::Disconnected
        })
    }

    pub(crate) fn is_alive(&self) -> bool {
        !*self.closed.borrow()
    }

    /// 子プロセスが終了するか、stdout が閉じるまで待つ
    pub(crate) async fn closed(&self) {
        let mut closed = self.closed.clone();
        let _ = closed.wait_for(|closed| *closed).await;
    }

    /// 待たずに cancel を送る（実行中のまま run の future が捨てられたときの後始末）
    pub(crate) fn cancel_in_background(self: Arc<Self>, id: &str) {
        let Ok(runtime) = tokio::runtime::Handle::try_current() else {
            return;
        };
        let id = id.to_owned();
        runtime.spawn(async move {
            let _ = self.send(&Request::Cancel { id: &id }).await;
        });
    }

    /// shutdown を送って終了を待ち、猶予を過ぎたら kill する
    pub(crate) async fn shutdown(&self, grace: Duration) {
        let _ = self.send(&Request::Shutdown).await;
        if tokio::time::timeout(grace, self.closed()).await.is_err() {
            log::warn!("ランナーが終了しないので強制終了します");
            if let Some(kill) = self.kill.lock().take() {
                let _ = kill.send(());
            }
            let _ = tokio::time::timeout(grace, self.closed()).await;
        }
    }
}

async fn handshake(ready: oneshot::Receiver<wire::Ready>, timeout: Duration) -> Result<Vec<BackendInfo>, StartError> {
    let ready = tokio::time::timeout(timeout, ready)
        .await
        .map_err(|_| StartError::ReadyTimeout)?
        .map_err(|_| StartError::Exited)?;
    if ready.protocol_version != PROTOCOL_VERSION {
        return Err(StartError::VersionMismatch { expected: PROTOCOL_VERSION, actual: ready.protocol_version });
    }
    log::info!("ランナー {} に接続しました", ready.runner_version);
    serde_json::from_value(ready.backends).map_err(|error| StartError::Protocol(error.to_string()))
}

/// 子プロセスの持ち主。終了を見届けるか、kill の合図（または Connection が捨てられた）で kill する
async fn watch_process(mut child: Child, kill: oneshot::Receiver<()>, closed: Arc<watch::Sender<bool>>) {
    tokio::select! {
        status = child.wait() => match status {
            Ok(status) if status.success() => log::info!("ランナーが終了しました"),
            Ok(status) => log::warn!("ランナーが異常終了しました（{status}）"),
            Err(error) => log::warn!("ランナーの終了を待てませんでした: {error}"),
        },
        _ = kill => {
            if let Err(error) = child.kill().await {
                log::warn!("ランナーを強制終了できませんでした: {error}");
            }
        }
    }
    closed.send_replace(true);
}
