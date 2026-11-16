//! 発言本文に書かれたローカルファイルのパス解決と、画像の安全な読み込み。

use std::fs::File;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use guild_domain::ids::AgentId;
use serde::Serialize;

use super::workspace::agent_work_dir;

const MAX_IMAGE_BYTES: u64 = 20 * 1024 * 1024;

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum LocalImage {
    Ok { mime: &'static str, base64: String },
    NotFound,
    Unsupported,
}

/// 画面から来たパスを OS のパスにする。相対パスには発言者の作業場所が必要。
pub fn resolve(path: &str, agent_id: Option<&AgentId>, data_dir: &Path) -> Option<PathBuf> {
    if path.is_empty() || path.contains('\0') {
        return None;
    }
    if let Some(rest) = path.strip_prefix("~/").or_else(|| path.strip_prefix("~\\")) {
        return std::env::home_dir().map(|home| home.join(native_relative(rest)));
    }
    if path.starts_with('/') || is_windows_absolute(path) {
        return Some(native_path(path));
    }
    let work = agent_work_dir(data_dir, agent_id?);
    let relative = native_relative(path);
    // エージェントが「work/output.png」と報告する場合も、作業場所の work/ として扱う。
    let relative = relative.strip_prefix("work").unwrap_or(&relative);
    Some(work.join(relative))
}

/// 実在する通常ファイルへ正規化する。NotFound だけは呼び出し側で区別できるようにする。
pub fn canonical_file(path: &Path) -> Result<PathBuf, FileCheckError> {
    let canonical = path.canonicalize().map_err(|error| match error.kind() {
        io::ErrorKind::NotFound => FileCheckError::NotFound,
        _ => FileCheckError::Unsupported,
    })?;
    if canonical.is_file() {
        Ok(canonical)
    } else {
        Err(FileCheckError::Unsupported)
    }
}

pub fn read_image(path: &Path) -> LocalImage {
    let canonical = match canonical_file(path) {
        Ok(path) => path,
        Err(FileCheckError::NotFound) => return LocalImage::NotFound,
        Err(FileCheckError::Unsupported) => return LocalImage::Unsupported,
    };
    let mut file = match File::open(canonical) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return LocalImage::NotFound,
        Err(_) => return LocalImage::Unsupported,
    };
    let metadata = match file.metadata() {
        Ok(metadata) if metadata.is_file() && metadata.len() <= MAX_IMAGE_BYTES => metadata,
        _ => return LocalImage::Unsupported,
    };
    let capacity = usize::try_from(metadata.len()).unwrap_or(0);
    let mut bytes = Vec::with_capacity(capacity);
    if file.by_ref().take(MAX_IMAGE_BYTES + 1).read_to_end(&mut bytes).is_err() || bytes.len() as u64 > MAX_IMAGE_BYTES
    {
        return LocalImage::Unsupported;
    }
    let Some(mime) = image_mime(&bytes) else {
        return LocalImage::Unsupported;
    };
    LocalImage::Ok { mime, base64: STANDARD.encode(bytes) }
}

#[derive(Debug, PartialEq, Eq)]
pub enum FileCheckError {
    NotFound,
    Unsupported,
}

fn image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

fn is_windows_absolute(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && matches!(bytes[2], b'/' | b'\\')
}

fn native_path(path: &str) -> PathBuf {
    if cfg!(windows) {
        PathBuf::from(path.replace('/', "\\"))
    } else {
        PathBuf::from(path)
    }
}

fn native_relative(path: &str) -> PathBuf {
    if cfg!(windows) {
        PathBuf::from(path.replace('/', "\\"))
    } else {
        PathBuf::from(path.replace('\\', "/"))
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("guild-local-files-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn resolves_absolute_home_windows_and_agent_relative_paths() {
        let data = Path::new("/guild-data");
        let agent = AgentId::new("agent-1");
        assert_eq!(resolve("/tmp/image.png", None, data), Some(PathBuf::from("/tmp/image.png")));
        assert_eq!(resolve("C:\\Users\\me\\image.png", None, data), Some(native_path("C:\\Users\\me\\image.png")));
        assert_eq!(resolve("D:/work/image.png", None, data), Some(native_path("D:/work/image.png")));
        assert_eq!(
            resolve("output/image.png", Some(&agent), data),
            Some(agent_work_dir(data, &agent).join(native_relative("output/image.png")))
        );
        assert_eq!(
            resolve("work/output.png", Some(&agent), data),
            Some(agent_work_dir(data, &agent).join("output.png"))
        );
        let home = std::env::home_dir().unwrap();
        assert_eq!(resolve("~/image.png", None, data), Some(home.join("image.png")));
    }

    #[test]
    fn rejects_relative_path_without_agent() {
        assert_eq!(resolve("output/image.png", None, Path::new("/guild-data")), None);
    }

    #[test]
    fn reads_a_valid_png_by_magic_bytes() {
        let temp = TempDir::new();
        let path = temp.0.join("image.not-an-extension");
        fs::write(&path, b"\x89PNG\r\n\x1a\nrest").unwrap();
        assert_eq!(
            read_image(&path),
            LocalImage::Ok { mime: "image/png", base64: STANDARD.encode(b"\x89PNG\r\n\x1a\nrest") }
        );
    }

    #[test]
    fn rejects_non_image_oversized_missing_and_directory() {
        let temp = TempDir::new();
        let text = temp.0.join("text.png");
        fs::write(&text, b"not an image").unwrap();
        assert_eq!(read_image(&text), LocalImage::Unsupported);

        let large = temp.0.join("large.png");
        let file = File::create(&large).unwrap();
        file.set_len(MAX_IMAGE_BYTES + 1).unwrap();
        assert_eq!(read_image(&large), LocalImage::Unsupported);
        assert_eq!(read_image(&temp.0.join("missing.png")), LocalImage::NotFound);
        assert_eq!(read_image(&temp.0), LocalImage::Unsupported);
    }

    #[test]
    fn serializes_statuses_for_the_frontend_contract() {
        assert_eq!(
            serde_json::to_value(LocalImage::Ok { mime: "image/png", base64: "abc".to_owned() }).unwrap(),
            serde_json::json!({ "status": "ok", "mime": "image/png", "base64": "abc" })
        );
        assert_eq!(serde_json::to_value(LocalImage::NotFound).unwrap(), serde_json::json!({ "status": "notFound" }));
        assert_eq!(
            serde_json::to_value(LocalImage::Unsupported).unwrap(),
            serde_json::json!({ "status": "unsupported" })
        );
    }
}
