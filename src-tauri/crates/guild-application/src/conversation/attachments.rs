//! 人間の発言に添えた画像・ファイルの保存・読み出し・ファイラでの表示。

use guild_domain::attachment::{validate_attachments, Attachment, NewAttachment};
use guild_domain::ids::{AttachmentId, ChannelId, MessageId};
use guild_domain::locale;

use crate::error::{AppError, AppResult};
use crate::services::Ports;

/// 検証してから中身を保存し、発言に持たせるメタデータを返す（添えた順）
pub(super) fn store(ports: &Ports, channel_id: &ChannelId, items: &[NewAttachment]) -> AppResult<Vec<Attachment>> {
    validate_attachments(items)?;
    items
        .iter()
        .map(|item| {
            let attachment = item.describe(AttachmentId::new(ports.ids.new_id()));
            ports.attachments.save(channel_id, &attachment, &item.bytes)?;
            Ok(attachment)
        })
        .collect()
}

/// 発言に添えたもののメタデータと中身
pub(super) fn read(
    ports: &Ports,
    message_id: &MessageId,
    attachment_id: &AttachmentId,
) -> AppResult<(Attachment, Vec<u8>)> {
    let (channel_id, attachment) = find(ports, message_id, attachment_id)?;
    let bytes = ports.attachments.read(&channel_id, &attachment)?;
    Ok((attachment, bytes))
}

/// 発言に添えたものを OS のファイラで表示する
pub(super) fn reveal(ports: &Ports, message_id: &MessageId, attachment_id: &AttachmentId) -> AppResult<()> {
    let (channel_id, attachment) = find(ports, message_id, attachment_id)?;
    ports.attachments.reveal(&channel_id, &attachment)
}

fn find(ports: &Ports, message_id: &MessageId, attachment_id: &AttachmentId) -> AppResult<(ChannelId, Attachment)> {
    let message = ports.messages.get(message_id)?.ok_or(AppError::NotFound(locale::pick([
        "発言",
        "Message",
        "消息",
        "訊息",
        "메시지",
    ])))?;
    let attachment = message
        .attachments
        .into_iter()
        .find(|attachment| &attachment.id == attachment_id)
        .ok_or(AppError::NotFound(locale::pick(["添付", "Attachment", "附件", "附件", "첨부 파일"])))?;
    Ok((message.channel_id, attachment))
}
