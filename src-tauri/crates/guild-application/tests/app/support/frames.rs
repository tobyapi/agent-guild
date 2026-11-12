//! 枠の画像のフェイク: 画像の依頼の返し方と、取り込み（検査と加工は本体クレートのテストで確かめる）。

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use guild_application::ports::{FrameImageStore, FrameImportError};
use guild_application::{AppError, AppResult};
use guild_domain::frame::FrameImageProblem;
use parking_lot::Mutex;

/// 画像の依頼の返し方
pub enum ImageScript {
    /// 描けた（PNG が output にある）
    Drawn,
    Fail(String),
    /// 中断されるまで返さない
    Hang,
}

/// 取り込んだ絵を覚えておく置き場所。problem があれば、次の取り込みをその理由で断る
#[derive(Default)]
pub struct FakeFrameImages {
    /// 枠の ID → 取り込んだ元のファイル
    pub stored: Mutex<HashMap<String, PathBuf>>,
    pub problem: Mutex<Option<FrameImageProblem>>,
}

impl FrameImageStore for FakeFrameImages {
    fn import(&self, frame_id: &str, source: &Path) -> Result<(), FrameImportError> {
        if let Some(problem) = self.problem.lock().take() {
            return Err(FrameImportError::Unusable(problem));
        }
        self.stored.lock().insert(frame_id.to_owned(), source.to_path_buf());
        Ok(())
    }

    fn read(&self, frame_id: &str) -> AppResult<Vec<u8>> {
        let stored = self.stored.lock();
        let source = stored.get(frame_id).ok_or(AppError::NotFound("絵"))?;
        Ok(format!("png:{}", source.display()).into_bytes())
    }

    fn delete(&self, frame_id: &str) -> AppResult<()> {
        self.stored.lock().remove(frame_id);
        Ok(())
    }
}
