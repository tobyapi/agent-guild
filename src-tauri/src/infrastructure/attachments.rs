//! 添付（人間が発言に添えた画像・ファイル）の置き場所（AttachmentStore の実装）: <dataDir>/attachments/<channelId>/<id>.<拡張子>。
//! チャンネルの ID と添付の ID はアプリが振った UUID だが、フォルダ名・ファイル名にするときは使える形に直す
//! （".." や区切りを含む ID で attachments/ の外を指させない。UUID はそのまま）。

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use guild_application::ports::AttachmentStore;
use guild_application::{AppError, AppResult};
use guild_domain::attachment::Attachment;
use guild_domain::ids::ChannelId;
use guild_domain::locale;

use super::data_dir::{safe_component, ATTACHMENTS_DIR};
use super::file_manager;

pub struct FsAttachments {
    root: PathBuf,
}

impl FsAttachments {
    pub fn new(data_dir: &Path) -> Self {
        Self { root: data_dir.join(ATTACHMENTS_DIR) }
    }
}

impl AttachmentStore for FsAttachments {
    fn save(&self, channel: &ChannelId, attachment: &Attachment, bytes: &[u8]) -> AppResult<()> {
        let dir = self.channel_dir(channel);
        fs::create_dir_all(&dir).and_then(|()| fs::write(self.path(channel, attachment), bytes)).map_err(|error| {
            storage(
                [
                    "添付を保存できません",
                    "Cannot save the attachment",
                    "无法保存附件",
                    "無法儲存附件",
                    "첨부 파일을 저장할 수 없습니다",
                ],
                &error,
            )
        })
    }

    fn read(&self, channel: &ChannelId, attachment: &Attachment) -> AppResult<Vec<u8>> {
        fs::read(self.path(channel, attachment)).map_err(|error| match error.kind() {
            io::ErrorKind::NotFound => AppError::NotFound(attachment_file()),
            _ => storage(
                [
                    "添付を読めません",
                    "Cannot read the attachment",
                    "无法读取附件",
                    "無法讀取附件",
                    "첨부 파일을 읽을 수 없습니다",
                ],
                &error,
            ),
        })
    }

    fn path(&self, channel: &ChannelId, attachment: &Attachment) -> PathBuf {
        self.channel_dir(channel).join(safe_file_name(&attachment.file_name()))
    }

    fn channel_dir(&self, channel: &ChannelId) -> PathBuf {
        self.root.join(safe_component(channel.as_str()))
    }

    fn reveal(&self, channel: &ChannelId, attachment: &Attachment) -> AppResult<()> {
        let path = self.path(channel, attachment);
        if !path.is_file() {
            return Err(AppError::NotFound(attachment_file()));
        }
        file_manager::reveal_file(&path).map_err(|error| {
            storage(
                [
                    "ファイラで開けませんでした",
                    "Could not show it in the file manager",
                    "无法在文件管理器中打开",
                    "無法在檔案總管中開啟",
                    "파일 관리자에서 열 수 없습니다",
                ],
                &error,
            )
        })
    }

    fn delete_channel(&self, channel: &ChannelId) -> AppResult<()> {
        match fs::remove_dir_all(self.channel_dir(channel)) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => Err(storage(
                [
                    "添付を消せません",
                    "Cannot delete the attachment",
                    "无法删除附件",
                    "無法刪除附件",
                    "첨부 파일을 삭제할 수 없습니다",
                ],
                &error,
            )),
            _ => Ok(()),
        }
    }
}

/// 「<id>.<拡張子>」の id と拡張子を、それぞれフォルダ名に使える形にする
fn safe_file_name(name: &str) -> String {
    match name.rsplit_once('.') {
        Some((stem, extension)) => format!("{}.{}", safe_component(stem), safe_component(extension)),
        None => safe_component(name),
    }
}

/// what は失敗した操作（日本語・英語・簡体字・繁体字・韓国語の順）
fn storage(what: [&str; 5], error: &io::Error) -> AppError {
    AppError::Storage(format!("{}: {error}", locale::pick(what)))
}

fn attachment_file() -> &'static str {
    locale::pick(["添付のファイル", "Attachment file", "附件文件", "附件檔案", "첨부 파일"])
}
