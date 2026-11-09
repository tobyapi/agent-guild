//! 起動方法（`Launch`）と追加の引数・環境変数から、子プロセスのコマンドを組み立てる。

use std::process::Stdio;

use tokio::process::Command;

use crate::{Launch, RunnerConfig};

/// Windows でコンソールウィンドウを出さずに起動するフラグ
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// stdin・stdout・stderr をすべてパイプにしたコマンド。`Child` が捨てられたら子も止める。
pub(crate) fn command(config: &RunnerConfig) -> Command {
    let mut command = match &config.launch {
        Launch::Node { node, script } => {
            let mut command = Command::new(node);
            command.arg(script);
            command
        }
        Launch::Binary { path } => Command::new(path),
    };
    command
        .args(&config.args)
        .envs(config.env.iter().map(|(key, value)| (key, value)))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    if let Some(cwd) = &config.cwd {
        command.current_dir(cwd);
    }
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}
