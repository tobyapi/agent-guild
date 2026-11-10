//! 公式のネイティブインストーラーを利用者の権限で動かす。

use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use guild_application::ports::RuntimeError;
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::time::timeout;

static INSTALL_LOCK: Mutex<()> = Mutex::const_new(());

pub(super) async fn install(backend: &str) -> Result<(), RuntimeError> {
    let (label, binary, url, shell) = match backend {
        "claude" => ("Claude Code", "claude", "https://claude.ai/install.sh", "/bin/bash"),
        "codex" => ("Codex", "codex", "https://chatgpt.com/codex/install.sh", "/bin/sh"),
        _ => return Err(failed("セットアップの対象が不正です")),
    };
    let _install = INSTALL_LOCK.lock().await;
    let home = std::env::home_dir().ok_or_else(|| failed("ホームフォルダが見つかりませんでした。"))?;
    let bin = home.join(".local").join("bin");
    let executable = bin.join(binary);
    if executable.is_file() {
        return Ok(());
    }
    let script = download(url, label).await?;
    // インストール先を PATH に含めると、公式インストーラーはシェルの設定を編集しない。
    let path = std::env::join_paths([
        bin.as_path(),
        Path::new("/usr/bin"),
        Path::new("/bin"),
        Path::new("/usr/sbin"),
        Path::new("/sbin"),
    ])
    .map_err(|_| failed("インストール先のフォルダを使えませんでした。"))?;
    let mut installer = Command::new(shell);
    installer
        .arg("-c")
        .arg(script)
        .env_clear()
        .env("HOME", &home)
        .env("PATH", path)
        .current_dir(home)
        .stdin(Stdio::null())
        .kill_on_drop(true);
    if backend == "codex" {
        installer.env("CODEX_INSTALL_DIR", bin).env("CODEX_NON_INTERACTIVE", "1");
    }
    let error = format!("{label} をインストールできませんでした。接続と空き容量を確認して、もう一度お試しください。");
    let output = timeout(Duration::from_secs(600), installer.output())
        .await
        .map_err(|_| failed(&format!("{label} のセットアップが時間切れになりました。もう一度お試しください。")))?
        .map_err(|cause| logged_failure(&error, cause))?;
    if !output.status.success() || !executable.is_file() {
        return Err(logged_failure(&error, String::from_utf8_lossy(&output.stderr)));
    }
    Ok(())
}

async fn download(url: &str, label: &str) -> Result<String, RuntimeError> {
    let error = format!(
        "{label} のインストーラーを取得できませんでした。インターネット接続を確認して、もう一度お試しください。"
    );
    let output = Command::new("/usr/bin/curl")
        .args([
            "-q",
            "-fsSL",
            "--proto",
            "=https",
            "--proto-redir",
            "=https",
            "--max-time",
            "30",
            "--max-filesize",
            "131072",
            url,
        ])
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|cause| logged_failure(&error, cause))?;
    if !output.status.success() || !output.stdout.starts_with(b"#!/bin/") {
        return Err(logged_failure(&error, String::from_utf8_lossy(&output.stderr)));
    }
    String::from_utf8(output.stdout).map_err(|cause| logged_failure(&error, cause))
}

fn logged_failure(message: &str, cause: impl std::fmt::Display) -> RuntimeError {
    log::warn!("{message} {cause}");
    failed(message)
}

fn failed(message: &str) -> RuntimeError {
    RuntimeError::Failed(message.to_owned())
}
