//! 止まっているバックエンドのアプリ（macOS に登録されたもの）を、利用者の操作で開く。

use std::time::Duration;

use guild_application::ports::RuntimeError;
use guild_domain::backend::StartSpec;
use tokio::process::Command;
use tokio::time::timeout;

use super::setup_text;

/// label は案内に出すバックエンドの名前
pub(super) async fn open(label: &str, spec: &StartSpec) -> Result<(), RuntimeError> {
    let bundle_id = spec.mac_bundle_id.as_str();
    let well_formed = !bundle_id.is_empty()
        && !bundle_id.starts_with('-')
        && bundle_id.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-'));
    if !well_formed {
        return Err(RuntimeError::Failed(setup_text::bad_app(label)));
    }
    let mut launcher = Command::new("/usr/bin/open");
    launcher.args(["-g", "-b", bundle_id]).kill_on_drop(true);
    let result = timeout(Duration::from_secs(10), launcher.output()).await;
    match result {
        Ok(Ok(output)) if output.status.success() => Ok(()),
        Ok(Ok(output)) => {
            log::warn!("{label} を開けませんでした: {}", String::from_utf8_lossy(&output.stderr));
            Err(RuntimeError::Failed(setup_text::app_not_installed(label)))
        }
        _ => Err(RuntimeError::Failed(setup_text::open_manually(label))),
    }
}
