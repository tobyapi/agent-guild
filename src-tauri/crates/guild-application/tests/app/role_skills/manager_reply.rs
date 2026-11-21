use super::request_for;
use crate::support::runtime::ready_backend;
use crate::support::{input, TestApp};
use guild_domain::agent::templates;
use guild_domain::skill::LibraryAddMode;

const GUIDANCE: &str = include_str!("../../../../guild-domain/src/prompt/manager_reply.md");

#[tokio::test]
async fn only_managers_get_reply_guidance_once_on_every_backend_with_or_without_skills() {
    for backend in ["claude", "codex", "grok", "muse", "ollama", "deepseek", "gemini"] {
        for template in templates() {
            let app = TestApp::new();
            *app.runtime.backends.lock() = vec![ready_backend(backend)];
            let manager = app.services.agents.create(input("manager", "担当")).unwrap();
            let is_manager = template.id == "manager";
            let mut updated = input(&template.id, &manager.name);
            updated.backend = backend.into();
            updated.can_delegate = !is_manager;
            if !is_manager {
                updated.tags.extend(manager.tags.clone());
            }
            let agent = app.services.agents.update(&manager.id, updated).unwrap();
            let channel = app.channel("相談", &[&agent]);
            for linked in [true, false] {
                if !linked {
                    for skill in app.services.skills.list(&agent.id).unwrap() {
                        app.services.skills.delete(&skill.id).unwrap();
                    }
                }
                for tools in [true, false] {
                    let mut info = ready_backend(backend);
                    if !tools {
                        info.capabilities = Default::default();
                    }
                    *app.runtime.backends.lock() = vec![info];
                    let request = request_for(&app, &agent, &channel).await;
                    assert_eq!(request.backend, backend);
                    for name in ["eli5", "universal-manager"] {
                        assert_eq!(request.skills.iter().any(|s| s.name == name), linked && tools);
                    }
                    assert_eq!(
                        request.system_prompt.matches(GUIDANCE.trim_end()).count(),
                        usize::from(is_manager),
                        "role={} backend={backend} linked={linked} tools={tools}",
                        template.id,
                    );
                }
            }
        }
    }
}

#[tokio::test]
async fn existing_manager_with_only_pre_eli5_links_gets_reply_guidance_after_restart() {
    let old = TestApp::new();
    let manager = old.agent("manager", "進行役");
    for name in ["universal-manager", "reflection"] {
        old.services.skills.add_builtin(&manager.id, name, LibraryAddMode::Link).unwrap();
    }
    let channel = old.channel("相談", &[&manager]);
    let app = old.restart();
    let request = request_for(&app, &manager, &channel).await;
    let mut names: Vec<_> = request.skills.iter().map(|s| s.name.as_str()).collect();
    names.sort_unstable();
    assert_eq!(names, ["reflection", "universal-manager"]);
    assert_eq!(request.system_prompt.matches(GUIDANCE.trim_end()).count(), 1);
    assert!(request.skills.iter().all(|s| !s.body.contains("## ユーザーへの話し方")));
}

#[tokio::test]
async fn manager_without_file_tools_receives_reply_guidance_and_only_the_visible_memory_tail() {
    let app = TestApp::new();
    let manager = app.agent("manager", "進行役");
    let channel = app.channel("相談", &[&manager]);
    app.runtime.backends.lock()[0].capabilities = Default::default();
    let earlier = "【ユーザーへの話し方】以前の希望：毎回ログを添える";
    let latest = "【ユーザーへの話し方】新しい希望：通常は要点だけ";
    *app.workspace.memory.lock() = format!("{earlier}\n{}\n{latest}", "あ".repeat(4000));
    let request = request_for(&app, &manager, &channel).await;
    assert!(request.skills.is_empty());
    assert_eq!(request.system_prompt.matches(GUIDANCE.trim_end()).count(), 1);
    assert!(!request.system_prompt.contains(earlier));
    assert!(request.system_prompt.contains(latest));
}
