//! 画像・ファイルつきの発言: 保存・読み出し・エージェントへの受け渡し・ファイラでの表示・チャンネルの削除と、バックエンドのログイン。

use guild_application::AppError;
use guild_domain::attachment::NewAttachment;
use guild_domain::ids::{AttachmentId, MessageId};

use super::support::TestApp;

fn png(name: &str) -> NewAttachment {
    NewAttachment { name: name.to_owned(), media_type: "image/png".to_owned(), bytes: vec![137, 80, 78, 71] }
}

#[tokio::test]
async fn images_are_stored_and_passed_to_the_agent_with_the_message() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    let sent = app.services.conversation.send_human_message(&lobby.id, "", &[png("screen.png")]).unwrap();
    assert_eq!((sent.content.as_str(), sent.attachments.len()), ("", 1), "画像だけの発言も送れる");
    let attachment = sent.attachments[0].clone();
    assert_eq!((attachment.name.as_str(), attachment.size), ("screen.png", 4));
    let read = app.services.conversation.attachment(&sent.id, &attachment.id).unwrap();
    assert_eq!(read, (attachment.clone(), vec![137, 80, 78, 71]));

    app.settle().await;
    let requests = app.runtime.requests.lock();
    let (_, _, request) = requests.last().expect("ハルが実行された");
    assert_eq!(request.images.len(), 1);
    assert_eq!(request.images[0].media_type, "image/png");
    assert!(request.images[0].path.ends_with(attachment.file_name()));
    assert!(request.prompt.contains("# 添付画像"));
}

#[tokio::test]
async fn files_are_passed_by_path_with_read_access_and_can_be_revealed() {
    let app = TestApp::new();
    let haru = app.agent("worker", "ハル");
    let lobby = app.channel("ロビー", &[&haru]);
    let pdf = NewAttachment {
        name: "仕様.pdf".to_owned(),
        media_type: "application/pdf".to_owned(),
        bytes: vec![37, 80, 68, 70],
    };
    let sent = app.services.conversation.send_human_message(&lobby.id, "読んで", &[pdf, png("a.png")]).unwrap();
    app.settle().await;
    let file = sent.attachments[0].clone();
    {
        let requests = app.runtime.requests.lock();
        let (_, _, request) = requests.last().expect("ハルが実行された");
        assert_eq!(request.images.len(), 1, "画像だけを画像として渡す");
        let dir = std::path::PathBuf::from(format!("/guild/attachments/{}", lobby.id.as_str()));
        assert!(request.readable_dirs.contains(&dir), "添付のフォルダを読めるようにする");
        assert!(request.prompt.contains(&format!("/guild/attachments/{}/{}", lobby.id.as_str(), file.file_name())));
    }
    app.services.conversation.reveal_attachment(&sent.id, &file.id).unwrap();
    assert_eq!(app.attachments.revealed.lock().len(), 1);
    let missing = app.services.conversation.reveal_attachment(&sent.id, &AttachmentId::new("nope"));
    assert!(matches!(missing, Err(AppError::NotFound(_))));
}

#[tokio::test]
async fn invalid_attachments_are_rejected_before_anything_is_saved() {
    let app = TestApp::new();
    let lobby = app.channel("ロビー", &[]);
    let too_many = vec![png("a.png"); 11];
    let error = app.services.conversation.send_human_message(&lobby.id, "見て", &too_many).unwrap_err();
    assert!(matches!(error, AppError::Validation(ref v) if v.field() == Some("attachments")), "{error}");
    let odd_type = NewAttachment { media_type: "画像".to_owned(), ..png("a.png") };
    assert!(app.services.conversation.send_human_message(&lobby.id, "見て", &[odd_type]).is_err());
    assert!(app.services.conversation.send_human_message(&lobby.id, "  ", &[]).is_err(), "本文も画像もない");
    assert!(app.attachments.files.lock().is_empty());
}

#[tokio::test]
async fn unknown_messages_and_images_are_not_found_and_deleting_the_channel_removes_images() {
    let app = TestApp::new();
    let lobby = app.channel("ロビー", &[]);
    let sent = app.services.conversation.send_human_message(&lobby.id, "保存して", &[png("a.png")]).unwrap();
    let missing = app.services.conversation.attachment(&sent.id, &AttachmentId::new("nope"));
    assert!(matches!(missing, Err(AppError::NotFound(_))));
    let missing = app.services.conversation.attachment(&MessageId::new("nope"), &sent.attachments[0].id);
    assert!(matches!(missing, Err(AppError::NotFound(_))));
    assert_eq!(app.attachments.files.lock().len(), 1);
    app.services.channels.delete(&lobby.id).await.unwrap();
    assert!(app.attachments.files.lock().is_empty());
}

#[tokio::test]
async fn login_goes_to_the_runtime_only_for_backends_that_allow_it() {
    let app = TestApp::new();
    app.services.backends.login("claude").await.unwrap();
    assert_eq!(*app.runtime.logins.lock(), ["claude"]);
    assert!(matches!(app.services.backends.login("nope").await, Err(AppError::NotFound(_))));
    app.runtime.backends.lock()[0].setup.login = None;
    assert!(matches!(app.services.backends.login("claude").await, Err(AppError::Validation(_))));
    assert_eq!(app.runtime.logins.lock().len(), 1);
}
