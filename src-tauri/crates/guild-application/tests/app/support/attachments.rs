//! インメモリの添付の置き場所（パス → 中身）。ファイラでの表示は記録だけする。

use std::collections::HashMap;
use std::path::PathBuf;

use guild_application::ports::AttachmentStore;
use guild_application::{AppError, AppResult};
use guild_domain::attachment::Attachment;
use guild_domain::ids::ChannelId;
use parking_lot::Mutex;

#[derive(Default)]
pub struct FakeAttachments {
    pub files: Mutex<HashMap<PathBuf, Vec<u8>>>,
    /// ファイラで表示したパス（表示した順）
    pub revealed: Mutex<Vec<PathBuf>>,
}

impl AttachmentStore for FakeAttachments {
    fn save(&self, channel: &ChannelId, attachment: &Attachment, bytes: &[u8]) -> AppResult<()> {
        self.files.lock().insert(self.path(channel, attachment), bytes.to_vec());
        Ok(())
    }

    fn read(&self, channel: &ChannelId, attachment: &Attachment) -> AppResult<Vec<u8>> {
        self.files.lock().get(&self.path(channel, attachment)).cloned().ok_or(AppError::NotFound("画像のファイル"))
    }

    fn path(&self, channel: &ChannelId, attachment: &Attachment) -> PathBuf {
        PathBuf::from(format!("/guild/attachments/{}/{}", channel.as_str(), attachment.file_name()))
    }

    fn channel_dir(&self, channel: &ChannelId) -> PathBuf {
        PathBuf::from(format!("/guild/attachments/{}", channel.as_str()))
    }

    fn reveal(&self, channel: &ChannelId, attachment: &Attachment) -> AppResult<()> {
        let path = self.path(channel, attachment);
        if !self.files.lock().contains_key(&path) {
            return Err(AppError::NotFound("添付のファイル"));
        }
        self.revealed.lock().push(path);
        Ok(())
    }

    fn delete_channel(&self, channel: &ChannelId) -> AppResult<()> {
        let prefix = PathBuf::from(format!("/guild/attachments/{}", channel.as_str()));
        self.files.lock().retain(|path, _| !path.starts_with(&prefix));
        Ok(())
    }
}
