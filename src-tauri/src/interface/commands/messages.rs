//! 発言のコマンド: 一覧（seq でページング）・送信（画像・ファイルつき）・画像の取得・ファイルの表示・停止と、割り振りの一覧。

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use guild_application::AppError;
use guild_domain::attachment::{AttachmentInput, NewAttachment};
use guild_domain::delegation::Delegation;
use guild_domain::error::{CommandError, ValidationError};
use guild_domain::ids::{AttachmentId, ChannelId, MessageId};
use guild_domain::message::Message;
use tauri::State;

use super::{reject, CommandResult};
use crate::interface::state::AppState;

/// seq の昇順。before_seq より前の最新 limit 件（既定50・上限200）
#[tauri::command]
pub async fn list_messages(
    state: State<'_, AppState>,
    channel_id: ChannelId,
    before_seq: Option<i64>,
    limit: Option<u32>,
) -> CommandResult<Vec<Message>> {
    state.services()?.conversation.list_messages(&channel_id, before_seq, limit).map_err(reject)
}

/// 人間の発言（と貼った画像）を保存して振り分けを始める（message-created でも届く）
#[tauri::command]
pub async fn send_message(
    state: State<'_, AppState>,
    channel_id: ChannelId,
    content: String,
    attachments: Vec<AttachmentInput>,
) -> CommandResult<Message> {
    let images = attachments.into_iter().map(decode).collect::<Result<Vec<_>, _>>()?;
    state.services()?.conversation.send_human_message(&channel_id, &content, &images).map_err(reject)
}

/// 発言に貼った画像を data URL で返す（img にそのまま渡せる。CSP の img-src は data: を許している）
#[tauri::command]
pub async fn get_attachment(
    state: State<'_, AppState>,
    message_id: MessageId,
    attachment_id: AttachmentId,
) -> CommandResult<String> {
    let (attachment, bytes) = state.services()?.conversation.attachment(&message_id, &attachment_id).map_err(reject)?;
    Ok(format!("data:{};base64,{}", attachment.media_type, STANDARD.encode(bytes)))
}

/// 発言に添えたファイルを OS のファイラで表示する（ファイルを選んだ状態で開く。ファイルそのものは開かない）
#[tauri::command]
pub async fn reveal_attachment(
    state: State<'_, AppState>,
    message_id: MessageId,
    attachment_id: AttachmentId,
) -> CommandResult<()> {
    state.services()?.conversation.reveal_attachment(&message_id, &attachment_id).map_err(reject)
}

/// 待機を破棄し、実行中を中断し、割り振りを打ち切って、終端を待ってから「停止しました」を出す
#[tauri::command]
pub async fn stop_channel(state: State<'_, AppState>, channel_id: ChannelId) -> CommandResult<()> {
    state.services()?.conversation.stop(&channel_id).await.map_err(reject)
}

/// そのチャンネルの割り振り（createdAt の昇順。新しい方から最大200件）
#[tauri::command]
pub async fn list_delegations(state: State<'_, AppState>, channel_id: ChannelId) -> CommandResult<Vec<Delegation>> {
    state.services()?.conversation.list_delegations(&channel_id).map_err(reject)
}

/// base64 の中身をデコードする（形式・大きさの検証はユースケースが行う）
fn decode(input: AttachmentInput) -> Result<NewAttachment, CommandError> {
    let bytes = STANDARD
        .decode(input.data.as_bytes())
        .map_err(|_| reject(AppError::from(ValidationError::on("attachments", "画像を読み取れませんでした"))))?;
    Ok(NewAttachment { name: input.name, media_type: input.media_type, bytes })
}
