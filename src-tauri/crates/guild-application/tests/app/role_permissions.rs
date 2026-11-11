//! 権限は役割だけで決まり、バックエンドでは変わらない: 保存・全体像・ランナーへの依頼のどれも同じ。
//! バックエンドで変わるのは、プロンプトの「できること」に書く「実際に使える操作」だけ。
use crate::support::runtime::{ready_backend, reply};
use crate::support::TestApp;
use guild_application::ports::RuntimeRequest;
use guild_domain::agent::{templates, Agent, PermissionKey, Permissions};
use guild_domain::backend::{BackendInfo, PermissionRule};

/// コマンドを隔離できないので、外への書き込みと Web も許す役割でだけコマンドを使えるバックエンド
fn unsandboxed() -> BackendInfo {
    let mut info = ready_backend("unsandboxed");
    info.permission_rules = vec![PermissionRule {
        when: PermissionKey::RunCommands,
        requires: vec![PermissionKey::WriteAnywhere, PermissionKey::WebFetch],
    }];
    info
}

/// 道具を何も持たない（会話だけの）バックエンド
fn chat_only() -> BackendInfo {
    let mut info = ready_backend("chat-only");
    info.capabilities = Permissions::default();
    info
}

/// その役割のエージェントを backend で1回動かしたときの、エージェントと依頼
async fn run_once(template: &str, backend: BackendInfo) -> (TestApp, Agent, RuntimeRequest) {
    let app = TestApp::new();
    let mut agent = app.agent(template, "ハル");
    agent.backend = backend.id.clone();
    for stored in app.store.agents.lock().iter_mut().filter(|stored| stored.id == agent.id) {
        stored.backend = agent.backend.clone();
    }
    app.runtime.backends.lock().push(backend);
    let channel = app.channel("作業", &[&agent]);
    app.runtime.script(agent.id.as_str(), reply("了解です。"));
    let sent = app.services.conversation.send_human_message(&channel.id, "@ハル お願いします", &[]);
    assert!(sent.is_ok(), "{template}: 発言を送れること");
    app.settle().await;
    let mut requests = app.runtime.requests_for(agent.id.as_str());
    assert_eq!(requests.len(), 1, "{template} / {}", agent.backend);
    (app, agent, requests.remove(0))
}

#[tokio::test]
async fn every_backend_receives_the_same_permissions_for_a_role() {
    for template in templates() {
        let role = template.defaults.permissions;
        for backend in [ready_backend("plain"), unsandboxed(), chat_only()] {
            let label = format!("{} / {}", template.id, backend.id);
            let (app, agent, request) = run_once(&template.id, backend).await;
            assert_eq!(request.permissions, role, "{label}: ランナーに渡す権限");
            let snapshot = app.services.snapshot.get().unwrap();
            let shown = snapshot.agents.iter().find(|a| a.id == agent.id).unwrap();
            assert_eq!(shown.permissions, role, "{label}: 画面に出す権限");
        }
    }
}

#[tokio::test]
async fn the_prompt_only_describes_what_the_backend_can_actually_use() {
    let (_, _, plain) = run_once("expert", ready_backend("plain")).await;
    assert!(plain.system_prompt.contains("コマンドの実行"), "隔離できるバックエンドではコマンドを使える");
    let (_, _, limited) = run_once("expert", unsandboxed()).await;
    assert!(limited.permissions.run_commands, "権限は役割のまま");
    assert!(!limited.system_prompt.contains("コマンドの実行"), "使えない操作は「できること」に書かない");
    assert!(limited.system_prompt.contains("作業場所でのファイルの読み書き"));
    let (_, _, chat) = run_once("worker", chat_only()).await;
    assert!(chat.system_prompt.contains("ツールは使えないので、会話だけで答えます。"));
    assert!(chat.skills.is_empty(), "使えないスキルは準備しない");
}
