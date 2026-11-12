//! 画像の依頼（image）: 要求の形・途中経過の中継・PNG の置き場所・エラーコード。

use runner_client::{ErrorCode, ImageRequest, RunUpdate, RunnerError, SkillPayload};

use crate::support::{no_updates, ready_client, updates, within};

fn image_request(prompt: &str, output: std::path::PathBuf) -> ImageRequest {
    ImageRequest {
        backend: "fake".to_owned(),
        workspace: r"C:\data\tools\frames\work".into(),
        state_dir: r"C:\data\tools\frames\state\fake".into(),
        // 枠の生成ではシステムプロンプトを足さない（空ならアダプタは何も渡さない）
        system_prompt: String::new(),
        prompt: prompt.to_owned(),
        skills: vec![SkillPayload {
            name: "ornate-avatar-frame".to_owned(),
            description: "装飾付きの枠".to_owned(),
            body: "# 装飾アイコン枠".to_owned(),
            dir: None,
            files: Vec::new(),
        }],
        output,
    }
}

fn temp_output(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("runner-client-image-{}-{name}", std::process::id()));
    if let Err(error) = std::fs::create_dir_all(&dir) {
        panic!("一時フォルダを作れません: {error}");
    }
    dir.join("frame.png")
}

#[tokio::test]
async fn image_sends_the_protocol_shape_and_relays_activity() {
    let client = ready_client("ok.mjs").await;
    let output = temp_output("shape");
    let (on_update, mut updates) = updates();
    within(client.generate_image("frame-1", image_request("roses", output.clone()), on_update)).await.expect("result");
    assert_eq!(updates.recv().await, Some(RunUpdate::Activity("drawing".to_owned())));
    let sent: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&output).expect("output に書かれる")).expect("JSON");
    assert_eq!(sent["type"], "image");
    assert_eq!(sent["id"], "frame-1");
    assert_eq!(sent["stateDir"], r"C:\data\tools\frames\state\fake");
    assert_eq!(sent["systemPrompt"], "");
    assert_eq!(sent["output"], output.to_string_lossy().as_ref());
    assert!(sent.get("permissions").is_none(), "画像の依頼は権限を持たない");
    let skill = serde_json::json!({
        "name": "ornate-avatar-frame", "description": "装飾付きの枠", "body": "# 装飾アイコン枠", "dir": null, "files": []
    });
    assert_eq!(sent["skills"], serde_json::json!([skill]), "スキルは run と同じ形で送る");
    let _ = std::fs::remove_dir_all(output.parent().expect("親"));
    client.shutdown().await;
}

#[tokio::test]
async fn image_errors_keep_their_codes() {
    let client = ready_client("ok.mjs").await;
    let failed =
        within(client.generate_image("frame-2", image_request("fail:bad_request", temp_output("x")), no_updates()))
            .await
            .expect_err("error");
    assert!(matches!(failed, RunnerError::Backend { code: ErrorCode::BadRequest, .. }));
    client.shutdown().await;
}
