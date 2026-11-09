//! エージェントに渡す添付の選び方: 応える発言（triggers）と、会話の起点の添付。
//! 起点はきっかけの発言か、プロンプトに入れる発言（history）にあるときだけ使う。会話のあるジョブの history には
//! 起点の発言を必ず入れるので、会話の最初に添えたものはいつも届く。
//! 割り振られた作業者や相談相手にも、人間が最初に添えたものが届くように起点を含める。
//! 画像は SDK の画像入力として渡す（1回に MAX_IMAGES_PER_RUN 枚まで）。ほかのファイルはパスを伝えて読んでもらう。

use super::JobSpec;
use crate::attachment::Attachment;
use crate::message::Message;

/// 1回の実行に添える画像の最大枚数
pub const MAX_IMAGES_PER_RUN: usize = 8;

/// 添付のある発言（seq の順・重複なし）
fn attachment_messages<'a>(job: &'a JobSpec, history: &'a [Message]) -> Vec<&'a Message> {
    let root = job
        .root_id
        .as_ref()
        .and_then(|id| job.triggers.iter().chain(history).find(|message| &message.id == id));
    let mut messages: Vec<&Message> =
        root.into_iter().chain(&job.triggers).filter(|message| !message.attachments.is_empty()).collect();
    messages.sort_by_key(|message| message.seq);
    messages.dedup_by(|a, b| a.id == b.id);
    messages
}

fn image_count(message: &Message) -> usize {
    message.attachments.iter().filter(|attachment| attachment.is_image()).count()
}

/// 画像を渡す発言（seq の順）。合計が上限を超えるなら新しい発言を優先し、
/// 上限に収まらない発言は丸ごと外す（1つの発言の画像を途中で切らない）
pub fn image_messages<'a>(job: &'a JobSpec, history: &'a [Message]) -> Vec<&'a Message> {
    let mut total = 0;
    let mut kept: Vec<&Message> = attachment_messages(job, history)
        .into_iter()
        .filter(|message| image_count(message) > 0)
        .rev()
        .take_while(|message| {
            total += image_count(message);
            total <= MAX_IMAGES_PER_RUN
        })
        .collect();
    kept.reverse();
    kept
}

/// パスを伝える画像以外のファイル（発言の順・添えた順）
pub fn file_attachments<'a>(job: &'a JobSpec, history: &'a [Message]) -> Vec<(&'a Message, &'a Attachment)> {
    attachment_messages(job, history)
        .into_iter()
        .flat_map(|message| {
            message.attachments.iter().filter(|attachment| !attachment.is_image()).map(move |attachment| (message, attachment))
        })
        .collect()
}
