//! 添付（画像・ファイル）: 検証・表示用の名前とファイル名・エージェントに渡す添付の選び方。

use guild_domain::attachment::{validate_attachments, Attachment, NewAttachment, MAX_FILE_BYTES, MAX_IMAGE_BYTES};
use guild_domain::author::Author;
use guild_domain::conversation::{file_attachments, image_messages, JobMode, JobSpec, MAX_IMAGES_PER_RUN};
use guild_domain::ids::{AgentId, AttachmentId, MessageId};
use guild_domain::message::Message;

use super::support::{by, message};

fn item(name: &str, media_type: &str, size: usize) -> NewAttachment {
    NewAttachment { name: name.to_owned(), media_type: media_type.to_owned(), bytes: vec![1; size] }
}

/// 人間の発言（起点は自分）に images 枚の画像と files 個のファイル
fn with_attachments(seq: i64, images: usize, files: usize) -> Message {
    let mut message = message(seq, Author::Human, "見て");
    let png = (0..images).map(|i| item("a.png", "image/png", 3).describe(AttachmentId::new(format!("m{seq}-i{i}"))));
    let pdf =
        (0..files).map(|i| item("b.pdf", "application/pdf", 3).describe(AttachmentId::new(format!("m{seq}-f{i}"))));
    message.attachments = png.chain(pdf).collect();
    message
}

#[test]
fn up_to_ten_attachments_images_of_5mb_files_of_10mb_and_30mb_in_total() {
    assert!(validate_attachments(&[item("a.png", "image/png", 3), item("仕様.pdf", "application/pdf", 3)]).is_ok());
    let eleven = vec![item("a.txt", "text/plain", 3); 11];
    assert_eq!(validate_attachments(&eleven).map_err(|error| error.field()), Err(Some("attachments")));
    assert!(validate_attachments(&[item("a.webp", "image/webp", MAX_IMAGE_BYTES)]).is_ok());
    assert!(validate_attachments(&[item("a.gif", "image/gif", MAX_IMAGE_BYTES + 1)]).is_err(), "画像は 5MB まで");
    assert!(
        validate_attachments(&[item("a.bmp", "image/bmp", MAX_IMAGE_BYTES + 1)]).is_ok(),
        "BMP はファイルとして 10MB まで"
    );
    assert!(validate_attachments(&[item("a.zip", "application/zip", MAX_FILE_BYTES + 1)]).is_err());
    let four = vec![item("a.bin", "application/octet-stream", MAX_FILE_BYTES); 4];
    assert!(validate_attachments(&four).is_err(), "合計 30MB まで");
    assert!(validate_attachments(&[item("a.txt", "text/plain", 0)]).is_err(), "空のファイル");
    assert!(validate_attachments(&[item("a.txt", "テキスト", 3)]).is_err(), "種類が MIME の形でない");
}

#[test]
fn names_are_tidied_for_display_and_files_keep_their_extension() {
    let image = item("C:\\Users\\me\\Pictures\\画面 1.png", "image/png", 10).describe(AttachmentId::new("a1"));
    let expected = Attachment {
        id: AttachmentId::new("a1"),
        name: "画面 1.png".to_owned(),
        media_type: "image/png".to_owned(),
        size: 10,
    };
    assert_eq!((image.clone(), image.file_name(), image.is_image()), (expected, "a1.png".to_owned(), true));
    let pdf = item("Report.PDF", "application/pdf", 1).describe(AttachmentId::new("a2"));
    assert_eq!((pdf.file_name(), pdf.is_image()), ("a2.pdf".to_owned(), false));
    assert_eq!(item("README", "text/plain", 1).describe(AttachmentId::new("a3")).file_name(), "a3.bin");
    assert_eq!(item("  ", "image/jpeg", 1).describe(AttachmentId::new("a4")).name, "image.jpg");
    assert_eq!(item("", "text/plain", 1).describe(AttachmentId::new("a5")).name, "file.bin");
    let long = item(&format!("{}.md", "長".repeat(150)), "text/markdown", 1).describe(AttachmentId::new("a6"));
    assert_eq!((long.name.chars().count(), long.file_name()), (100, "a6.md".to_owned()), "長い名前も拡張子は残す");
}

#[test]
fn agents_get_the_attachments_of_their_triggers_and_of_the_conversation_root() {
    let root = with_attachments(1, 2, 1);
    let mut consult = message(2, by("haru"), "@ロジカ 見てもらえますか");
    consult.root_id = root.id.clone();
    let job = JobSpec::respond(AgentId::new("logica"), &consult, JobMode::Reply, Vec::new());
    let history = vec![root.clone(), consult.clone()];
    let ids: Vec<&MessageId> = image_messages(&job, &history).iter().map(|m| &m.id).collect();
    assert_eq!(ids, [&root.id], "相談相手にも、人間が最初に添えた画像が届く");
    let files: Vec<&str> = file_attachments(&job, &history).iter().map(|(_, a)| a.id.as_str()).collect();
    assert_eq!(files, ["m1-f0"]);
    assert!(image_messages(&job, &history[1..]).is_empty(), "起点が直近の会話になければ渡さない");

    let human = with_attachments(3, 1, 0);
    let job = JobSpec::respond(AgentId::new("haru"), &human, JobMode::Reply, Vec::new());
    assert_eq!(image_messages(&job, std::slice::from_ref(&human)).len(), 1, "起点ときっかけが同じなら1回だけ");
    assert!(file_attachments(&job, std::slice::from_ref(&human)).is_empty());
}

#[test]
fn at_most_eight_images_preferring_the_newest_messages_and_files_are_not_counted() {
    let triggers = vec![with_attachments(1, 4, 0), with_attachments(2, 4, 3), with_attachments(3, 4, 0)];
    let mut job = JobSpec::respond(AgentId::new("haru"), &triggers[2], JobMode::Reply, Vec::new());
    job.triggers = triggers;
    let kept: Vec<i64> = image_messages(&job, &[]).iter().map(|m| m.seq).collect();
    assert_eq!(kept, [2, 3]);
    assert_eq!(MAX_IMAGES_PER_RUN, 8);
    assert_eq!(file_attachments(&job, &[]).len(), 3, "ファイルは枚数の上限に数えず、すべてパスを伝える");
}
