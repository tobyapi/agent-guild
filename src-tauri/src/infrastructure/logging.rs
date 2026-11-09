//! ログの出し先。配布版は <app_log_dir>/agent-guild.log（起動のたびに前回のものを agent-guild.old.log に回す）、
//! 開発中（debug ビルド）は stderr。ランナーの stderr もここに流れる（runner-client が log に書く）。

use std::fs::{self, File};
use std::path::{Path, PathBuf};

/// ログのファイル名
pub const LOG_FILE: &str = "agent-guild.log";
const PREVIOUS_LOG_FILE: &str = "agent-guild.old.log";

/// 一度だけ呼ぶ。ファイルを開けなければ stderr に出す。書いた先のファイル（stderr なら None）を返す
pub fn init(log_dir: Option<&Path>) -> Option<PathBuf> {
    let mut builder = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"));
    let file = if cfg!(debug_assertions) { None } else { log_dir.and_then(open_log_file) };
    if let Some((_, handle)) = &file {
        if let Ok(target) = handle.try_clone() {
            builder.target(env_logger::Target::Pipe(Box::new(target)));
        }
    }
    let _ = builder.try_init();
    file.map(|(path, _)| path)
}

/// 前回のログを回してから、新しいファイルを作る
fn open_log_file(dir: &Path) -> Option<(PathBuf, File)> {
    fs::create_dir_all(dir).ok()?;
    let path = dir.join(LOG_FILE);
    if path.exists() {
        let _ = fs::rename(&path, dir.join(PREVIOUS_LOG_FILE));
    }
    let file = File::create(&path).ok()?;
    Some((path, file))
}
