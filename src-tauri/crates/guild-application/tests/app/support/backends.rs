//! テストで使うバックエンドの申告。

use guild_domain::agent::Permissions;
use guild_domain::backend::{BackendInfo, BackendSetup, BackendStatus, LoginSpec};

pub fn ready_backend(id: &str) -> BackendInfo {
    let all = Permissions {
        web_search: true,
        web_fetch: true,
        read_files: true,
        read_anywhere: false,
        write_files: true,
        write_anywhere: true,
        run_commands: true,
        skills: true,
    };
    BackendInfo {
        id: id.to_owned(),
        label: id.to_owned(),
        models: Vec::new(),
        default_model: String::new(),
        capabilities: all,
        status: BackendStatus::Ready,
        status_message: String::new(),
        options: Vec::new(),
        permission_rules: Vec::new(),
        leak_risks: Vec::new(),
        unrestricted: Vec::new(),
        mid_run_post: None,
        folder_scope: None,
        tools_option: None,
        local: false,
        frame_generation: false,
        setup: BackendSetup {
            login: Some(LoginSpec {
                label: "ログイン".to_owned(), waiting: "ログインを待っています".to_owned()
            }),
            ..BackendSetup::default()
        },
    }
}
