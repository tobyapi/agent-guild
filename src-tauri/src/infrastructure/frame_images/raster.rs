//! 正方形の RGBA 画像（8bit・ストレートアルファ）と、PNG との読み書き。

use std::io::Cursor;

use guild_domain::frame::{FrameImageProblem, FRAME_SOURCE_MAX_SIDE, FRAME_SOURCE_MIN_SIDE};
use png::{BitDepth, ColorType, Compression, Decoder, Limits, Transformations};

/// PNG を読むときに確保してよいメモリの上限（2048×2048 の RGBA と 16bit の作業分に足りる）
const DECODE_LIMIT_BYTES: usize = 96 * 1024 * 1024;

/// 正方形の RGBA 画像。pixels は行ごとに side × 4 バイト
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rgba {
    pub side: u32,
    pub pixels: Vec<u8>,
}

impl Rgba {
    pub fn new(side: u32) -> Self {
        Self { side, pixels: vec![0; side as usize * side as usize * 4] }
    }

    pub fn index(&self, x: u32, y: u32) -> usize {
        (y as usize * self.side as usize + x as usize) * 4
    }

    pub fn alpha(&self, x: u32, y: u32) -> u8 {
        self.pixels[self.index(x, y) + 3]
    }
}

/// PNG を読み、正方形で大きさが範囲内なら RGBA にする（パレット・グレー・16bit・tRNS の透明は RGBA 8bit に直す）
pub fn decode(bytes: &[u8]) -> Result<Rgba, FrameImageProblem> {
    let mut decoder = Decoder::new_with_limits(Cursor::new(bytes), Limits { bytes: DECODE_LIMIT_BYTES });
    decoder.set_transformations(Transformations::normalize_to_color8());
    let mut reader = decoder.read_info().map_err(|_| FrameImageProblem::NotPng)?;
    let (width, height) = (reader.info().width, reader.info().height);
    if width != height || !(FRAME_SOURCE_MIN_SIDE..=FRAME_SOURCE_MAX_SIDE).contains(&width) {
        return Err(FrameImageProblem::BadSize);
    }
    let size = reader.output_buffer_size().ok_or(FrameImageProblem::NotPng)?;
    let mut buffer = vec![0; size];
    let info = reader.next_frame(&mut buffer).map_err(|_| FrameImageProblem::NotPng)?;
    if info.bit_depth != BitDepth::Eight || info.width != width || info.height != height {
        return Err(FrameImageProblem::NotPng);
    }
    let channels = match info.color_type {
        ColorType::Grayscale => 1,
        ColorType::GrayscaleAlpha => 2,
        ColorType::Rgb => 3,
        ColorType::Rgba => 4,
        ColorType::Indexed => return Err(FrameImageProblem::NotPng),
    };
    let mut image = Rgba::new(width);
    for y in 0..height {
        let row = &buffer[y as usize * info.line_size..][..width as usize * channels];
        for (x, sample) in row.chunks_exact(channels).enumerate() {
            let at = image.index(x as u32, y);
            image.pixels[at..at + 4].copy_from_slice(&to_rgba(sample));
        }
    }
    Ok(image)
}

fn to_rgba(sample: &[u8]) -> [u8; 4] {
    match *sample {
        [gray] => [gray, gray, gray, 255],
        [gray, alpha] => [gray, gray, gray, alpha],
        [r, g, b] => [r, g, b, 255],
        [r, g, b, a] => [r, g, b, a],
        _ => [0, 0, 0, 0],
    }
}

/// RGBA 8bit の PNG にする
pub fn encode(image: &Rgba) -> Result<Vec<u8>, png::EncodingError> {
    let mut out = Vec::new();
    let mut encoder = png::Encoder::new(&mut out, image.side, image.side);
    encoder.set_color(ColorType::Rgba);
    encoder.set_depth(BitDepth::Eight);
    encoder.set_compression(Compression::Balanced);
    let mut writer = encoder.write_header()?;
    writer.write_image_data(&image.pixels)?;
    writer.finish()?;
    Ok(out)
}
