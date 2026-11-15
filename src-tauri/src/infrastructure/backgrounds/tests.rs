use super::{raster, FsBackgrounds};
use crate::infrastructure::tests::TempDir;
use guild_application::backgrounds::BackgroundStore;
use guild_application::AppError;
use image::{DynamicImage, ImageFormat};
use std::fs;
use std::io::Cursor;

fn image(format: ImageFormat, width: u32, height: u32) -> Vec<u8> {
    let image = DynamicImage::ImageRgb8(image::RgbImage::from_pixel(width, height, image::Rgb([20, 80, 120])));
    let mut output = Cursor::new(Vec::new());
    image.write_to(&mut output, format).unwrap();
    output.into_inner()
}

#[test]
fn imports_all_three_formats_as_png_without_exposing_paths() {
    let dir = TempDir::new("background-formats");
    let store = FsBackgrounds::new(&dir.0);
    for format in [ImageFormat::Png, ImageFormat::Jpeg, ImageFormat::WebP] {
        let id = store.import(&image(format, 3, 2)).unwrap();
        assert_eq!(uuid::Uuid::parse_str(&id).unwrap().to_string(), id);
        let bytes = store.read(&id).unwrap();
        assert_eq!(image::guess_format(&bytes).unwrap(), ImageFormat::Png);
        let decoded = image::load_from_memory(&bytes).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (3, 2));
        assert!(dir.0.join("backgrounds").join(format!("{id}.png")).is_file());
    }
    assert_eq!(store.list().unwrap().len(), 3);
    assert!(fs::read_dir(dir.0.join("backgrounds")).unwrap().all(|e| e
        .unwrap()
        .path()
        .extension()
        .is_some_and(|ext| ext == "png")));
}

#[test]
fn rejects_empty_oversized_unsupported_and_damaged_inputs_without_writes() {
    let dir = TempDir::new("background-invalid");
    let store = FsBackgrounds::new(&dir.0);
    for bytes in [
        vec![],
        vec![0; raster::MAX_INPUT_BYTES + 1],
        b"GIF89a".to_vec(),
        b"not an image".to_vec(),
        b"\x89PNG\r\n\x1a\n".to_vec(),
    ] {
        assert!(matches!(store.import(&bytes), Err(AppError::Validation(_))));
    }
    assert!(store.list().unwrap().is_empty());
    assert!(!dir.0.join("backgrounds").exists());
}

#[test]
fn resizes_preserving_aspect_ratio_without_upscaling() {
    let dir = TempDir::new("background-resize");
    let store = FsBackgrounds::new(&dir.0);
    let id = store.import(&image(ImageFormat::Png, 5120, 4)).unwrap();
    let decoded = image::load_from_memory(&store.read(&id).unwrap()).unwrap();
    assert_eq!((decoded.width(), decoded.height()), (2560, 2));
    assert!(store.import(&image(ImageFormat::Png, 8193, 1)).is_err());
}

#[test]
fn drops_jpeg_exif_and_png_text_metadata() {
    let dir = TempDir::new("background-metadata");
    let store = FsBackgrounds::new(&dir.0);
    let jpeg = image(ImageFormat::Jpeg, 2, 2);
    // Valid EXIF TIFF header with no IFD entries, plus a private marker.
    let exif = b"Exif\0\0II\x2a\0\x08\0\0\0\0\0\0\0\0\0private-gps-marker";
    let mut source = jpeg[..2].to_vec();
    source.extend_from_slice(&[0xff, 0xe1]);
    source.extend_from_slice(&u16::try_from(exif.len() + 2).unwrap().to_be_bytes());
    source.extend_from_slice(exif);
    source.extend_from_slice(&jpeg[2..]);
    let id = store.import(&source).unwrap();
    let output = store.read(&id).unwrap();
    assert!(!output.windows(4).any(|w| w == b"eXIf"));
    assert!(!output.windows(18).any(|w| w == b"private-gps-marker"));
    let mut source = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut source, 1, 1);
        encoder.set_color(png::ColorType::Rgb);
        encoder.add_text_chunk("private".into(), "private-gps-marker".into()).unwrap();
        encoder.write_header().unwrap().write_image_data(&[0, 0, 0]).unwrap();
    }
    assert!(source.windows(4).any(|w| w == b"tEXt"));
    let id = store.import(&source).unwrap();
    assert!(!store.read(&id).unwrap().windows(4).any(|w| w == b"tEXt"));
}

#[test]
fn rejects_unsafe_ids_and_supports_deletion_and_absent_legacy_library() {
    let dir = TempDir::new("background-ids");
    let store = FsBackgrounds::new(&dir.0);
    assert!(store.list().unwrap().is_empty());
    let absent = uuid::Uuid::new_v4().to_string();
    assert!(matches!(store.read(&absent), Err(AppError::NotFound(_))));
    store.delete(&absent).unwrap();
    for id in ["../outside", "..", "", "C:\\secret", "/tmp/secret", "a/b", "a\\b", "NUL", "123.png"] {
        assert!(store.read(id).is_err());
        assert!(store.delete(id).is_err());
    }
    let id = store.import(&image(ImageFormat::Png, 2, 2)).unwrap();
    fs::write(dir.0.join("backgrounds").join("ignored.png.tmp"), b"partial").unwrap();
    assert_eq!(store.list().unwrap(), vec![id.clone()]);
    store.delete(&id).unwrap();
    store.delete(&id).unwrap();
    assert!(store.list().unwrap().is_empty());
}
