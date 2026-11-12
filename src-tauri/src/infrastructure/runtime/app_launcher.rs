//! macOS に登録された Ollama アプリを利用者の操作で開く。

use std::time::Duration;

use guild_application::ports::RuntimeError;
use tokio::process::Command;
use tokio::time::timeout;

pub(super) async fn open() -> Result<(), RuntimeError> {
    let mut launcher = Command::new("/usr/bin/open");
    launcher.args(["-g", "-b", "com.electron.ollama"]).kill_on_drop(true);
    let result = timeout(Duration::from_secs(10), launcher.output()).await;
    match result {
        Ok(Ok(output)) if output.status.success() => Ok(()),
        Ok(Ok(output)) => {
            log::warn!("Ollama を開けませんでした: {}", String::from_utf8_lossy(&output.stderr));
            Err(RuntimeError::Failed(
                "Ollama を開けませんでした。「アプリケーション」に Ollama が入っているか確認してください。".to_owned(),
            ))
        }
        _ => Err(RuntimeError::Failed(
            "Ollama を開けませんでした。Ollama アプリを開いて「再確認」を押してください。".to_owned(),
        )),
    }
}
