//! 利用者の環境の PATH と、その中のプログラムの場所。macOS では Finder から起動したアプリに
//! シェルの設定（Homebrew・nvm など）の PATH が渡らないので、ログインシェルに PATH を聞いて、よく入れる場所も足す。

use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// ログインシェルに PATH を聞くときの上限（シェルの設定が止まっても、起動を待たせすぎない）
const SHELL_TIMEOUT: Duration = Duration::from_secs(5);
/// シェルの出力から PATH を見分ける印（設定ファイルが何か出力しても取り違えない）
const MARKER: &str = "__GUILD_PATH__";

/// ランナーに渡す PATH。macOS ではログインシェルの PATH（聞けなければいまの PATH）に、よく入れる場所を足す。
/// ほかの OS では親の PATH をそのまま使うので None
pub fn search_path() -> Option<String> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    let shell = std::env::var("SHELL").ok().filter(|value| !value.is_empty()).unwrap_or_else(|| "/bin/zsh".to_owned());
    let base = login_shell_path(&shell).or_else(|| std::env::var("PATH").ok()).unwrap_or_default();
    let home = std::env::var("HOME").unwrap_or_default();
    let common = [
        "/opt/homebrew/bin".to_owned(),
        "/usr/local/bin".to_owned(),
        format!("{home}/.local/bin"),
        format!("{home}/.volta/bin"),
    ];
    Some(merge_paths(&base, &common, ':'))
}

/// base の PATH のあとに、まだ入っていない extra を足す（空の要素は除く）
pub fn merge_paths(base: &str, extra: &[String], separator: char) -> String {
    let mut dirs: Vec<&str> = Vec::new();
    for dir in base.split(separator).chain(extra.iter().map(String::as_str)) {
        if !dir.is_empty() && !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    dirs.join(&separator.to_string())
}

/// シェルの出力のうち、印のあとの PATH（印がなければ None）
pub fn parse_marked(output: &str) -> Option<String> {
    let (_, path) = output.rsplit_once(MARKER)?;
    let path = path.trim();
    (!path.is_empty()).then(|| path.to_owned())
}

/// `shell -ilc` で設定ファイルを読んだシェルの PATH。止まったら上限で打ち切る
fn login_shell_path(shell: &str) -> Option<String> {
    let mut child = Command::new(shell)
        .args(["-ilc", &format!("printf '{MARKER}%s' \"$PATH\"")])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let deadline = Instant::now() + SHELL_TIMEOUT;
    while child.try_wait().ok()?.is_none() {
        if Instant::now() >= deadline {
            let _ = child.kill();
            return None;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    let mut output = String::new();
    child.stdout.take()?.read_to_string(&mut output).ok()?;
    parse_marked(&output)
}
