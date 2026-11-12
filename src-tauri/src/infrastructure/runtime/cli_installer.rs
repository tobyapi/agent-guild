//! 公式のネイティブインストーラーを利用者の権限で動かす。

use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use guild_application::ports::RuntimeError;
use guild_domain::backend::InstallGuide;
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::time::timeout;

use super::setup_text;

static INSTALL_LOCK: Mutex<()> = Mutex::const_new(());

pub(super) async fn install(guide: &InstallGuide) -> Result<(), RuntimeError> {
    let label = guide.cli.as_str();
    check(guide)?;
    let _install = INSTALL_LOCK.lock().await;
    let home = std::env::home_dir().ok_or_else(|| failed(&setup_text::no_home()))?;
    let bin = home.join(".local").join("bin");
    let executable = bin.join(&guide.binary);
    if executable.is_file() {
        return Ok(());
    }
    let script = download(&guide.script_url, label).await?;
    // インストール先を PATH に含めると、公式インストーラーはシェルの設定を編集しない。
    let path = std::env::join_paths([
        bin.as_path(),
        Path::new("/usr/bin"),
        Path::new("/bin"),
        Path::new("/usr/sbin"),
        Path::new("/sbin"),
    ])
    .map_err(|_| failed(&setup_text::bad_install_dir()))?;
    let mut installer = Command::new(&guide.shell);
    installer
        .arg("-c")
        .arg(script)
        .env_clear()
        .env("HOME", &home)
        .env("PATH", path)
        .current_dir(home)
        .stdin(Stdio::null())
        .kill_on_drop(true);
    let bin = bin.to_string_lossy();
    for (name, value) in &guide.env {
        installer.env(name, value.replace("{bin}", &bin));
    }
    let error = setup_text::install_failed(label);
    let output = timeout(Duration::from_secs(600), installer.output())
        .await
        .map_err(|_| failed(&setup_text::install_timed_out(label)))?
        .map_err(|cause| logged_failure(&error, cause))?;
    if !output.status.success() || !executable.is_file() {
        return Err(logged_failure(&error, String::from_utf8_lossy(&output.stderr)));
    }
    Ok(())
}

async fn download(url: &str, label: &str) -> Result<String, RuntimeError> {
    let error = setup_text::download_failed(label);
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

/// 申告されたインストーラーの形を確かめる（https の URL・絶対パスのシェル・フォルダを含まない実行ファイル名）
fn check(guide: &InstallGuide) -> Result<(), RuntimeError> {
    let plain_name = !guide.binary.is_empty() && !guide.binary.contains(['/', '\\']) && guide.binary != "..";
    if guide.script_url.starts_with("https://") && Path::new(&guide.shell).is_absolute() && plain_name {
        Ok(())
    } else {
        Err(failed(&setup_text::bad_target()))
    }
}
