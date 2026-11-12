//! テストの部品: 偽ランナーの起動設定・実行の依頼・状態の待ち合わせ。

use std::future::Future;
use std::path::PathBuf;
use std::time::Duration;

use runner_client::{
    ImagePayload, Launch, Permissions, RunRequest, RunUpdate, RunnerClient, RunnerConfig, RunnerStatus,
    SkillFilePayload, SkillPayload, UpdateFn,
};
use tokio::sync::mpsc;

pub const CANCEL_GRACE: Duration = Duration::from_millis(600);

pub fn fixture(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures").join(name)
}

pub fn config(script: &str) -> RunnerConfig {
    RunnerConfig {
        launch: Launch::Node { node: "node".into(), script: fixture(script) },
        args: vec!["--from-test".to_owned()],
        env: vec![("FAKE_FLAG".to_owned(), "on".to_owned())],
        cwd: Some(fixture("")),
        language: "ja".to_owned(),
        ready_timeout: Duration::from_secs(10),
        cancel_grace: CANCEL_GRACE,
    }
}

pub fn request(prompt: &str) -> RunRequest {
    let mut options = serde_json::Map::new();
    options.insert("maxTurns".to_owned(), 3.into());
    RunRequest {
        backend: "fake".to_owned(),
        workspace: r"C:\data\agents\a1\work".into(),
        state_dir: r"C:\data\agents\a1\state\fake".into(),
        readable_dirs: vec![r"C:\data\agents\a0\work".into()],
        writable_dirs: None,
        system_prompt: "あなたはテスト用のエージェントです。".to_owned(),
        prompt: prompt.to_owned(),
        intent: "# 人間の依頼\n> 試して\n".to_owned(),
        model: String::new(),
        permissions: Permissions {
            web_search: true,
            web_fetch: true,
            read_files: true,
            read_anywhere: false,
            write_files: false,
            write_anywhere: false,
            run_commands: false,
            skills: true,
        },
        images: vec![ImagePayload {
            path: r"C:\data\attachments\c1\f3a1.png".into(),
            media_type: "image/png".to_owned(),
        }],
        skills: vec![SkillPayload {
            name: "review-checklist".to_owned(),
            description: "レビューのチェックリスト".to_owned(),
            body: "# 手順\n1. 主張は1文で言えるか\n".to_owned(),
            dir: None,
            files: vec![SkillFilePayload { path: "references/examples.md".to_owned(), content: "# 例\n".to_owned() }],
        }],
        options,
    }
}

/// 10 秒以内に終わることを確かめて結果を返す
pub async fn within<T>(future: impl Future<Output = T>) -> T {
    match tokio::time::timeout(Duration::from_secs(10), future).await {
        Ok(output) => output,
        Err(_) => panic!("10 秒以内に終わらなかった"),
    }
}

pub async fn wait_status(client: &RunnerClient, accept: impl Fn(&RunnerStatus) -> bool) -> RunnerStatus {
    let mut receiver = client.watch_status();
    let matched = within(receiver.wait_for(|status| accept(status))).await.map(|status| (*status).clone());
    matched.unwrap_or_else(|_| panic!("状態を受け取れない（RunnerClient が捨てられた）"))
}

pub async fn ready_client(script: &str) -> RunnerClient {
    let client = RunnerClient::new(config(script));
    wait_status(&client, |status| *status == RunnerStatus::Ready).await;
    client
}

pub fn is_unavailable(status: &RunnerStatus) -> bool {
    matches!(status, RunnerStatus::Unavailable { .. })
}

/// 実行中の知らせ（途中経過・途中の投稿）を受け取るチャンネルつきのコールバック
pub fn updates() -> (UpdateFn, mpsc::UnboundedReceiver<RunUpdate>) {
    let (sender, receiver) = mpsc::unbounded_channel();
    let on_update: UpdateFn = Box::new(move |update| {
        let _ = sender.send(update);
    });
    (on_update, receiver)
}

pub fn no_updates() -> UpdateFn {
    Box::new(|_| {})
}
