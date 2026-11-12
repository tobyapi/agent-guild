//! 生成した枠の画像の取り込み: 使えない画像（PNG でない・正方形でない・小さすぎる・背景を切り分けられない・枠がない・
//! 大きすぎる・ない）は断ること、frames/ の中に保存して読み・消せること。背景・穴・大きさの加工は fitting.rs。

mod fitting;
mod painting;

use std::fs;

use guild_application::ports::{FrameImageStore, FrameImportError};
use guild_application::AppError;
use guild_domain::frame::{FrameImageProblem, FRAME_SOURCE_MAX_BYTES, FRAME_SOURCE_MIN_SIDE};

use super::TempDir;
use crate::infrastructure::frame_images::{prepare, FsFrameImages};
use painting::{encode, problem, Painting, CLEAR};

#[test]
fn backgrounds_that_cannot_be_separated_are_refused() {
    // 白い背景は枠の明るい部分まで抜けてしまうので抜かない。縁がまだらでも抜かない
    let white = Painting { background: [250, 250, 250, 255], ..Painting::keyed(512) };
    assert_eq!(problem(prepare(&white.png())), FrameImageProblem::Background);
    let mut noisy = Vec::new();
    for i in 0..512u32 * 512 {
        noisy.extend_from_slice(&[(i * 37 % 256) as u8, (i * 91 % 256) as u8, (i * 13 % 256) as u8, 255]);
    }
    assert_eq!(problem(prepare(&encode(512, 512, &noisy))), FrameImageProblem::Background);
}

#[test]
fn images_without_a_frame_around_the_opening_are_refused() {
    let nothing = Painting { band: -1.0, gem: false, stain: false, ..Painting::keyed(512) };
    assert_eq!(problem(prepare(&nothing.png())), FrameImageProblem::NoFrame);
    // 上の辺の飾りだけで、穴を囲んでいない
    let mut bar = vec![0u8; 256 * 256 * 4];
    for y in 20..40 {
        for x in 30..226 {
            bar[(y * 256 + x) * 4..][..4].copy_from_slice(&[120, 72, 30, 255]);
        }
    }
    assert_eq!(problem(prepare(&encode(256, 256, &bar))), FrameImageProblem::NoFrame);
}

#[test]
fn non_png_non_square_and_too_small_images_are_refused() {
    assert_eq!(problem(prepare(b"GIF89a not a png")), FrameImageProblem::NotPng);
    assert_eq!(problem(prepare(&encode(600, 512, &vec![255; 600 * 512 * 4]))), FrameImageProblem::BadSize);
    let tiny = Painting { background: CLEAR, ..Painting::keyed(FRAME_SOURCE_MIN_SIDE - 1) };
    assert_eq!(problem(prepare(&tiny.png())), FrameImageProblem::BadSize);
    // スキルの既定の 64px と、もっと小さい 32px は受け取る（外周に透明な余白のある、本当に透明な背景の絵）
    for side in [FRAME_SOURCE_MIN_SIDE, 64] {
        let small = Painting { background: CLEAR, band: 12.0, ..Painting::keyed(side) };
        assert!(prepare(&small.png()).is_ok(), "{side}px");
    }
}

#[test]
fn imported_images_are_saved_read_and_deleted_inside_the_frames_folder() {
    let data = TempDir::new("frame-images");
    let store = FsFrameImages::new(&data.0);
    let source = data.0.join("drawn.png");
    fs::write(&source, Painting::keyed(1024).png()).unwrap();
    store.import("custom:abc-1", &source).unwrap();
    let saved = data.0.join("frames").join("custom_abc-1.png");
    assert!(saved.is_file());
    assert_eq!(store.read("custom:abc-1").unwrap(), fs::read(&saved).unwrap());
    // 区切りや .. を含む ID でも frames/ の外には書かない
    store.import("custom:../../x", &source).unwrap();
    assert!(data.0.join("frames").join("custom_______x.png").is_file());
    store.delete("custom:abc-1").unwrap();
    store.delete("custom:abc-1").unwrap();
    assert!(!saved.exists());
    assert!(matches!(store.read("custom:abc-1"), Err(AppError::NotFound(_))));
}

#[test]
fn missing_and_oversized_files_are_refused_before_reading() {
    let data = TempDir::new("frame-images-limits");
    let store = FsFrameImages::new(&data.0);
    let missing = store.import("custom:a", &data.0.join("nothing.png"));
    assert!(matches!(missing, Err(FrameImportError::Unusable(FrameImageProblem::Missing))));
    let huge = data.0.join("huge.png");
    fs::write(&huge, vec![0u8; usize::try_from(FRAME_SOURCE_MAX_BYTES).unwrap() + 1]).unwrap();
    let oversized = store.import("custom:a", &huge);
    assert!(matches!(oversized, Err(FrameImportError::Unusable(FrameImageProblem::TooLarge))));
    assert!(!data.0.join("frames").exists(), "何も保存しない");
}
