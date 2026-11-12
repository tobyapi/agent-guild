//! 生成した枠の絵の置き場所（FrameImageStore の実装）: <dataDir>/frames/<枠の ID をファイル名にできる形にしたもの>.png。
//! 取り込むときに検査して整える: ファイルの大きさ → PNG として読めて正方形か → 背景を透明に（matte.rs。すでに透明なら
//! そのまま）→ 描かれた穴を決まった穴に合わせる（fit.rs）→ 穴のまわりに枠の帯があるか → 上限より大きければ縮める（小さい
//! 画像は拡大しない。スキルの既定の 64px はそのままの細かさで保存する）→ 中央の穴をくり抜く（shape.rs）→ RGBA の PNG で保存。

mod fit;
mod matte;
mod raster;
mod shape;

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use guild_application::ports::{FrameImageStore, FrameImportError};
use guild_application::{AppError, AppResult};
use guild_domain::frame::{FrameImageProblem, FRAME_IMAGE_MAX_SIDE, FRAME_SOURCE_MAX_BYTES};
use guild_domain::locale;

use super::data_dir::{safe_component, FRAMES_DIR};

pub struct FsFrameImages {
    root: PathBuf,
}

impl FsFrameImages {
    pub fn new(data_dir: &Path) -> Self {
        Self { root: data_dir.join(FRAMES_DIR) }
    }

    /// 枠の ID（`custom:<ID>`）のファイル。区切りや `..` を含む ID でも frames/ の外を指させない
    fn path(&self, frame_id: &str) -> PathBuf {
        self.root.join(format!("{}.png", safe_component(frame_id)))
    }
}

/// 生成された PNG のバイト列を、保存する PNG にする
pub fn prepare(bytes: &[u8]) -> Result<Vec<u8>, FrameImportError> {
    let mut image = raster::decode(bytes).map_err(FrameImportError::Unusable)?;
    matte::remove_background(&mut image).map_err(FrameImportError::Unusable)?;
    let image = fit::fit_opening(&image);
    shape::check_band(&image).map_err(FrameImportError::Unusable)?;
    let mut image = if image.side > FRAME_IMAGE_MAX_SIDE { shape::resize(&image, FRAME_IMAGE_MAX_SIDE) } else { image };
    shape::punch_opening(&mut image);
    raster::encode(&image).map_err(|error| FrameImportError::Failed(AppError::Storage(cannot_save(&error.to_string()))))
}

impl FrameImageStore for FsFrameImages {
    fn import(&self, frame_id: &str, source: &Path) -> Result<(), FrameImportError> {
        let size = match fs::metadata(source) {
            Ok(meta) if meta.is_file() => meta.len(),
            Ok(_) => return Err(FrameImportError::Unusable(FrameImageProblem::Missing)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return Err(FrameImportError::Unusable(FrameImageProblem::Missing))
            }
            Err(error) => return Err(failed(&error)),
        };
        if size > FRAME_SOURCE_MAX_BYTES {
            return Err(FrameImportError::Unusable(FrameImageProblem::TooLarge));
        }
        let png = prepare(&fs::read(source).map_err(|error| failed(&error))?)?;
        let path = self.path(frame_id);
        let temp = path.with_extension("png.tmp");
        fs::create_dir_all(&self.root)
            .and_then(|()| fs::write(&temp, png))
            .and_then(|()| fs::rename(&temp, &path))
            .map_err(|error| {
                let _ = fs::remove_file(&temp);
                failed(&error)
            })
    }

    fn read(&self, frame_id: &str) -> AppResult<Vec<u8>> {
        fs::read(self.path(frame_id)).map_err(|error| match error.kind() {
            io::ErrorKind::NotFound => AppError::NotFound(image_subject()),
            _ => AppError::Storage(cannot_read(&error.to_string())),
        })
    }

    fn delete(&self, frame_id: &str) -> AppResult<()> {
        match fs::remove_file(self.path(frame_id)) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => Err(AppError::Storage(cannot_delete(&error))),
            _ => Ok(()),
        }
    }
}

fn failed(error: &io::Error) -> FrameImportError {
    FrameImportError::Failed(AppError::Storage(cannot_save(&error.to_string())))
}

fn image_subject() -> &'static str {
    locale::pick(["アイコンの枠の画像", "Avatar frame image", "头像框图像", "頭像框圖像", "아이콘 테두리 이미지"])
}

fn cannot_save(reason: &str) -> String {
    locale::pick([
        format!("枠の画像を保存できません: {reason}"),
        format!("Cannot save the frame image: {reason}"),
        format!("无法保存头像框图像：{reason}"),
        format!("無法儲存頭像框圖像：{reason}"),
        format!("테두리 이미지를 저장할 수 없습니다: {reason}"),
    ])
}

fn cannot_read(reason: &str) -> String {
    locale::pick([
        format!("枠の画像を読めません: {reason}"),
        format!("Cannot read the frame image: {reason}"),
        format!("无法读取头像框图像：{reason}"),
        format!("無法讀取頭像框圖像：{reason}"),
        format!("테두리 이미지를 읽을 수 없습니다: {reason}"),
    ])
}

fn cannot_delete(error: &io::Error) -> String {
    locale::pick([
        format!("枠の画像を消せません: {error}"),
        format!("Cannot delete the frame image: {error}"),
        format!("无法删除头像框图像：{error}"),
        format!("無法刪除頭像框圖像：{error}"),
        format!("테두리 이미지를 삭제할 수 없습니다: {error}"),
    ])
}
