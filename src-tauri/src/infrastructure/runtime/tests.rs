//! ランナーの起動方法: リソースに同梱の runner があればそれを node で動かし、なければ開発用のスクリプト。
//! macOS 向けの PATH の組み立て（ログインシェルの出力の読み取り・足し合わせ）と、node の探し方。

use std::fs;
use std::path::Path;

use runner_client::Launch;

use super::launch::{runner_config, BUNDLED_DIR};
use super::user_path::{find_program, merge_paths, parse_marked};
use crate::infrastructure::tests::TempDir;

#[test]
fn the_bundled_runner_is_used_when_the_resources_have_it() {
    let resources = TempDir::new("resources");
    let script = resources.0.join(BUNDLED_DIR).join("agent-runner").join("src").join("main.js");
    fs::create_dir_all(script.parent().unwrap()).unwrap();
    fs::write(&script, "").unwrap();
    let config = runner_config(Some(&resources.0));
    assert!(matches!(&config.launch, Launch::Node { script: used, .. } if used == &script));
    assert_eq!(config.cwd, Some(resources.0.join(BUNDLED_DIR)));
}

#[test]
fn without_the_bundled_runner_the_development_script_is_used() {
    let resources = TempDir::new("no-runner");
    let development = Path::new("agent-runner").join("src").join("main.ts");
    for config in [runner_config(Some(&resources.0)), runner_config(None)] {
        assert!(matches!(&config.launch, Launch::Node { script, .. } if script.ends_with(&development)));
    }
}

#[test]
fn the_login_shell_path_is_read_after_the_marker_and_common_dirs_are_added() {
    let output = "ようこそ\n__GUILD_PATH__/opt/homebrew/bin:/usr/bin\n";
    assert_eq!(parse_marked(output), Some("/opt/homebrew/bin:/usr/bin".to_owned()));
    assert_eq!(parse_marked("印のない出力"), None);
    assert_eq!(parse_marked("__GUILD_PATH__  "), None);
    let extra = ["/usr/bin".to_owned(), "/Users/me/.local/bin".to_owned()];
    assert_eq!(merge_paths("/opt/homebrew/bin::/usr/bin", &extra, ':'), "/opt/homebrew/bin:/usr/bin:/Users/me/.local/bin");
}

#[test]
fn node_is_looked_up_in_the_given_path() {
    let dir = TempDir::new("bin");
    let file = if cfg!(windows) { "node.exe" } else { "node" };
    fs::write(dir.0.join(file), "").unwrap();
    let path = dir.0.display().to_string();
    assert_eq!(find_program("node", Some(&path)), Some(dir.0.join(file)));
    assert_eq!(find_program("no-such-program", Some(&path)), None);
}
