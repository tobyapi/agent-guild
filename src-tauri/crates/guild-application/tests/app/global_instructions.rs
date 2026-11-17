use crate::support::runtime::{ready_backend, reply};
use crate::support::{input, TestApp};
use guild_application::ports::SettingsStore;

#[tokio::test]
async fn global_instructions_reach_every_backend_and_refresh_without_restart() {
    for backend in ["claude", "codex", "grok", "muse", "ollama", "deepseek", "gemini", "future-backend"] {
        let app = TestApp::new();
        app.runtime.backends.lock().push(ready_backend(backend));
        let agent = app.services.agents.create(input("worker", "Worker")).unwrap();
        let mut changed = input("worker", "Worker");
        changed.backend = backend.to_owned();
        let agent = app.services.agents.update(&agent.id, changed).unwrap();
        let channel = app.channel("test", &[&agent]);
        assert_eq!(app.services.global_instructions.get().unwrap(), "");
        for instruction in ["FIRST_SHARED_RULE", "SECOND_SHARED_RULE", ""] {
            app.services.global_instructions.set(instruction.to_owned()).unwrap();
            app.runtime.script(agent.id.as_str(), reply("[PASS]"));
            app.services.conversation.send_human_message(&channel.id, "run", &[]).unwrap();
            app.settle().await;
            let request = app.runtime.requests_for(agent.id.as_str()).pop().unwrap();
            assert_eq!(request.backend, backend);
            if !instruction.is_empty() {
                let persona = request.system_prompt.find("Worker").unwrap();
                let shared = request.system_prompt.find("## 全エージェント共通の指示").unwrap();
                let work = request.system_prompt.find("## あなたの仕事").unwrap();
                assert!(persona < shared && shared < work);
            }
            assert_eq!(request.system_prompt.contains("FIRST_SHARED_RULE"), instruction == "FIRST_SHARED_RULE");
            assert_eq!(request.system_prompt.contains("SECOND_SHARED_RULE"), instruction == "SECOND_SHARED_RULE");
            assert_eq!(request.system_prompt.contains("## 全エージェント共通の指示"), !instruction.is_empty());
        }
    }
}

#[tokio::test]
async fn global_instructions_preserve_other_settings_and_reject_oversize() {
    let app = TestApp::new();
    let mut settings = app.settings.load().unwrap();
    settings.setup_done = true;
    app.settings.save(&settings).unwrap();
    app.services.global_instructions.set("  # Markdown\n日本語 😀\n".to_owned()).unwrap();
    let saved = app.settings.load().unwrap();
    assert!(saved.setup_done);
    assert_eq!(saved.global_instructions, "  # Markdown\n日本語 😀\n");
    assert!(app.services.global_instructions.set("a".repeat(4_001)).is_err());
    assert_eq!(app.settings.load().unwrap(), saved);
    settings.global_instructions = "a".repeat(4_001);
    app.settings.save(&settings).unwrap();
    assert_eq!(app.services.global_instructions.get().unwrap().len(), 4_001);
}

#[tokio::test]
async fn global_instructions_follow_tasks_consultations_reports_and_free_time() {
    let app = TestApp::new();
    let manager = app.agent("manager", "Lead");
    let worker = app.agent("worker", "Worker");
    let expert = app.agent("expert", "Expert");
    let channel = app.channel("routes", &[&manager, &worker]);
    app.services.global_instructions.set("ALL_ROUTES_RULE".to_owned()).unwrap();
    app.runtime.script(manager.id.as_str(), reply("```tasks\n@Worker: implement\n```"));
    app.runtime.script(worker.id.as_str(), reply("@Expert review"));
    app.runtime.script(expert.id.as_str(), reply("reviewed"));
    app.runtime.script(worker.id.as_str(), reply("done"));
    app.runtime.script(manager.id.as_str(), reply("summary"));
    app.services.conversation.send_human_message(&channel.id, "start", &[]).unwrap();
    app.settle().await;
    assert_eq!(app.runtime.requests_for(manager.id.as_str()).len(), 2);
    assert_eq!(app.runtime.requests_for(worker.id.as_str()).len(), 2);
    assert_eq!(app.runtime.requests_for(expert.id.as_str()).len(), 1);
    app.runtime.script(worker.id.as_str(), reply("free time"));
    app.services.autonomy.run_now(&worker.id).unwrap();
    app.settle().await;
    assert_eq!(app.runtime.requests_for(worker.id.as_str()).len(), 3);
    for (_, _, request) in app.runtime.requests.lock().iter() {
        assert!(request.system_prompt.contains("ALL_ROUTES_RULE"));
    }
}

#[tokio::test]
async fn global_instructions_invalid_or_unreadable_settings_do_not_stop_conversation() {
    let mut baseline = None;
    for mode in ["empty", "oversized", "unreadable"] {
        let app = TestApp::new();
        let agent = app.agent("worker", "Worker");
        let channel = app.channel("test", &[&agent]);
        let mut settings = app.settings.load().unwrap();
        if mode != "empty" {
            settings.global_instructions = "OVERSIZED_RULE".repeat(400);
        }
        app.settings.save(&settings).unwrap();
        app.settings.fail_load.store(mode == "unreadable", std::sync::atomic::Ordering::SeqCst);
        app.runtime.script(agent.id.as_str(), reply("completed despite invalid settings"));
        app.services.conversation.send_human_message(&channel.id, "run", &[]).unwrap();
        app.settle().await;
        let requests = app.runtime.requests_for(agent.id.as_str());
        assert_eq!(requests.len(), 1);
        let prompt = &requests[0].system_prompt;
        if let Some(expected) = &baseline {
            assert_eq!(prompt, expected);
        } else {
            baseline = Some(prompt.clone());
        }
        assert!(app
            .store
            .messages
            .lock()
            .iter()
            .any(|message| message.content == "completed despite invalid settings"));
    }
}
