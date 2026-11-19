use super::TempDir;
use crate::infrastructure::local_link::{resolve, Action};
use guild_application::AppError;
use std::fs;

#[test]
fn opens_an_existing_markdown_document_or_shows_it_on_request() {
    let dir = TempDir::new("document-link");
    let sample: serde_json::Value =
        serde_json::from_str(include_str!("../../../../contracts/ipc/open-local-path.json")).unwrap();
    let args = &sample["args"];
    let filename = std::path::Path::new(args["path"].as_str().unwrap()).file_name().unwrap();
    let file = dir.0.join(filename);
    fs::write(&file, "# 手順").unwrap();
    let path = file.to_str().unwrap();
    let (target, action) = resolve(path, args["reveal"].as_bool().unwrap()).unwrap();
    assert_eq!(fs::read_to_string(target).unwrap(), "# 手順");
    assert_eq!(action, Action::OpenDocument);
    assert_eq!(resolve(path, true).unwrap().1, Action::ShowFile);
    assert_eq!(resolve(dir.0.to_str().unwrap(), false).unwrap().1, Action::OpenFolder);
}

#[test]
fn selects_files_outside_the_document_allowlist() {
    let dir = TempDir::new("select-file");
    for name in [
        "run.exe",
        "run.ps1",
        "run.cmd",
        "link.lnk",
        "link.url",
        "page.html",
        "image.svg",
        "notes.md.exe",
        "no-extension",
    ] {
        let path = dir.0.join(name);
        fs::write(&path, []).unwrap();
        assert_eq!(resolve(path.to_str().unwrap(), false).unwrap().1, Action::ShowFile, "{name}");
    }
}

#[test]
fn rejects_relative_network_and_device_paths() {
    for path in [
        "docs/guide.md",
        "C:guide.md",
        r"\\server\share\a.md",
        "//server/share",
        r"\\?\UNC\server\share\a.md",
        r"\\.\C:\a.md",
        "file://host/a.md",
    ] {
        assert!(matches!(resolve(path, false), Err(AppError::Validation(_))), "{path}");
    }
}

#[test]
fn returns_not_found_for_a_missing_link() {
    let dir = TempDir::new("missing-link");
    assert!(matches!(resolve(dir.0.join("missing.md").to_str().unwrap(), false), Err(AppError::NotFound(_))));
}

#[cfg(windows)]
#[test]
fn rejects_resolved_unc_streams_and_reserved_device_names() {
    use crate::infrastructure::local_link::shell_path;
    use std::path::PathBuf;
    assert!(matches!(shell_path(PathBuf::from(r"\\?\UNC\host\share\a.md")), Err(AppError::Validation(_))));
    for path in [r"C:\docs\a:stream.md", r"C:\docs\NUL.txt", r"C:\docs\guide.md."] {
        assert!(matches!(resolve(path, false), Err(AppError::Validation(_))), "{path}");
    }
}

#[cfg(unix)]
#[test]
fn selects_disguised_symlinks_and_executable_documents() {
    use std::os::unix::fs::{symlink, PermissionsExt};
    let dir = TempDir::new("linked-document");
    let script = dir.0.join("script.sh");
    fs::write(&script, []).unwrap();
    let link = dir.0.join("guide.md");
    symlink(&script, &link).unwrap();
    assert_eq!(resolve(link.to_str().unwrap(), false).unwrap().1, Action::ShowFile);
    let doc = dir.0.join("executable.md");
    fs::write(&doc, []).unwrap();
    fs::set_permissions(&doc, fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(resolve(doc.to_str().unwrap(), false).unwrap().1, Action::ShowFile);
}
