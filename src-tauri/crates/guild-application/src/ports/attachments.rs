//! 添付（人間が発言に添えた画像・ファイル）の中身の置き場所。実装はデータフォルダの attachments/<チャンネル>/<ファイル名>。

use std::path::PathBuf;

use guild_domain::attachment::Attachment;
use guild_domain::ids::ChannelId;

use crate::error::AppResult;

pub trait AttachmentStore: Send + Sync {
    /// 中身を保存する
    fn save(&self, channel: &ChannelId, attachment: &Attachment, bytes: &[u8]) -> AppResult<()>;
    /// 中身を読む
    fn read(&self, channel: &ChannelId, attachment: &Attachment) -> AppResult<Vec<u8>>;
    /// ランナーやエージェントに渡す絶対パス
    fn path(&self, channel: &ChannelId, attachment: &Attachment) -> PathBuf;
    /// チャンネルの添付を置くフォルダ（ファイルを読めるようにするとき readableDirs に入れる）
    fn channel_dir(&self, channel: &ChannelId) -> PathBuf;
    /// OS のファイラでファイルを表示する（そのファイルを選んだ状態で開く）
    fn reveal(&self, channel: &ChannelId, attachment: &Attachment) -> AppResult<()>;
    /// チャンネルの添付をすべて消す（チャンネルを消したとき）
    fn delete_channel(&self, channel: &ChannelId) -> AppResult<()>;
}
