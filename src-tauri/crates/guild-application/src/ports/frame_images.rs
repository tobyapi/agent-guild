//! 生成した枠の絵（PNG）の置き場所。実装はデータフォルダの frames/（画像の検査と加工も実装の中で行う）。

use std::path::Path;

use guild_domain::frame::FrameImageProblem;

use crate::error::{AppError, AppResult};

/// 取り込みに失敗した理由
#[derive(Debug)]
pub enum FrameImportError {
    /// 画像が枠として使えない（使用者に理由を見せて、生成し直してもらう）
    Unusable(FrameImageProblem),
    /// 読み書きの失敗など
    Failed(AppError),
}

pub trait FrameImageStore: Send + Sync {
    /// 生成された PNG（source）を検査して整え（正方形を決まった大きさにし、背景と中央の穴を透明にする）、
    /// その枠の絵として保存する
    fn import(&self, frame_id: &str, source: &Path) -> Result<(), FrameImportError>;
    /// 保存した絵（PNG のバイト列）
    fn read(&self, frame_id: &str) -> AppResult<Vec<u8>>;
    /// 保存した絵を消す（なければ何もしない）
    fn delete(&self, frame_id: &str) -> AppResult<()>;
}
