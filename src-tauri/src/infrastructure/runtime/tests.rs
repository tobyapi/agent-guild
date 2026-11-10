//! ランナーの起動方法と、macOS 向けの PATH の組み立て。

use std::fs;
use std::path::Path;

use runner_client::Launch;

use super::launch::{plain_path, runner_config, BUNDLED_DIR};
use super::user_path::{merge_paths, parse_marked};
use crate::infrastructure::tests::TempDir;

#[test]
fn the_bundled_runner_is_used_when_the_resources_have_it() {
    let resources = TempDir::new("resources");
    let script = resources.0.join(BUNDLED_DIR).join("agent-runner").join("src").join("main.js");
    fs::create_dir_all(script.parent().unwrap()).unwrap();
    fs::write(&script, "").unwrap();
    let config = runner_config(Some(&resources.0));
    let node = std::env::current_exe().unwrap().with_file_name(format!("guild-node{}", std::env::consts::EXE_SUFFIX));
    assert!(matches!(&config.launch, Launch::Node { script: used, node: executable }
        if used == &script && executable == &plain_path(&node)));
    assert_eq!(config.cwd, Some(resources.0.join(BUNDLED_DIR)));
}

#[test]
fn verbatim_windows_paths_become_plain_for_node() {
    assert_eq!(plain_path(Path::new(r"\\?\C:\Apps\agent-guild\runner")), Path::new(r"C:\Apps\agent-guild\runner"));
    assert_eq!(plain_path(Path::new(r"\\?\UNC\server\share\runner")), Path::new(r"\\server\share\runner"));
    assert_eq!(plain_path(Path::new(r"C:\Apps\runner")), Path::new(r"C:\Apps\runner"));
    assert_eq!(plain_path(Path::new("/Applications/agent-guild.app")), Path::new("/Applications/agent-guild.app"));
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
    assert_eq!(
        merge_paths("/opt/homebrew/bin::/usr/bin", &extra, ':'),
        "/opt/homebrew/bin:/usr/bin:/Users/me/.local/bin"
    );
}
