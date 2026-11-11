//! Windows のパスを、ほかのプログラムが扱える普通の形に直す。`fs::canonicalize` の結果や Tauri のリソースの場所は
//! `\\?\C:\...`（verbatim）で届くが、Node はそれを扱えず（lstat 'C:' で落ちる）、ランナーが行うパスの比較とも合わない。

use std::path::{Path, PathBuf};

/// `\\?\C:\a` → `C:\a`、`\\?\UNC\server\share\a` → `\\server\share\a`。それ以外（文字列にできないものを含む）はそのまま
pub fn plain_path(path: &Path) -> PathBuf {
    let Some(text) = path.to_str() else {
        return path.to_path_buf();
    };
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{rest}"));
    }
    text.strip_prefix(r"\\?\").map_or_else(|| path.to_path_buf(), PathBuf::from)
}
