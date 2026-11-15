//! Bounded image decoding and metadata-free PNG encoding.
use guild_application::{AppError, AppResult};
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};
use std::io::Cursor;

// Match attachment images; backgrounds are displayed once, up to a desktop-sized canvas.
pub const MAX_INPUT_BYTES: usize = guild_domain::attachment::MAX_IMAGE_BYTES;
pub const MAX_SIDE: u32 = 2560;
const MAX_SOURCE_SIDE: u32 = 8192;
const MAX_PIXELS: u64 = 32 * 1024 * 1024;

pub fn prepare(bytes: &[u8]) -> AppResult<Vec<u8>> {
    if bytes.is_empty() || bytes.len() > MAX_INPUT_BYTES {
        return Err(AppError::validation("Background image must be between 1 byte and 5 MiB"));
    }
    let format = image::guess_format(bytes).map_err(invalid)?;
    if !matches!(format, ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP) {
        return Err(AppError::validation("Background image must be PNG, JPEG or WebP"));
    }
    let (width, height) = ImageReader::with_format(Cursor::new(bytes), format).into_dimensions().map_err(invalid)?;
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > MAX_PIXELS {
        return Err(AppError::validation("Background image exceeds the decoded pixel limit"));
    }
    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_SOURCE_SIDE);
    limits.max_image_height = Some(MAX_SOURCE_SIDE);
    limits.max_alloc = Some(128 * 1024 * 1024);
    reader.limits(limits);
    let mut decoder = reader.into_decoder().map_err(invalid)?;
    let orientation = decoder.orientation().map_err(invalid)?;
    let mut image = DynamicImage::from_decoder(decoder).map_err(invalid)?;
    image.apply_orientation(orientation);
    let image = if width > MAX_SIDE || height > MAX_SIDE {
        image.resize(MAX_SIDE, MAX_SIDE, image::imageops::FilterType::Triangle)
    } else {
        image
    };
    // Construct fresh RGBA pixels: EXIF, ICC, text and other source metadata are never copied.
    let image = DynamicImage::ImageRgba8(image.to_rgba8());
    let mut output = Cursor::new(Vec::new());
    image.write_to(&mut output, ImageFormat::Png).map_err(invalid)?;
    Ok(output.into_inner())
}

fn invalid(_: image::ImageError) -> AppError {
    AppError::validation("Background image is damaged, unsupported or exceeds decoding limits")
}
