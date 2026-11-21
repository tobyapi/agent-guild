//! 役割ごとの内蔵スキル: 作成、役割変更、手動編集の保持。
use crate::support::runtime::{ready_backend, reply};
use crate::support::{input, TestApp};
use guild_application::ports::RuntimeRequest;
use guild_domain::agent::{templates, Agent};
use guild_domain::channel::Channel;
use guild_domain::skill::{find_builtin_skill, LibraryAddMode, SkillInput, SkillSource};

#[tokio::test]
async fn every_role_starts_with_linked_builtin_skills() {
    let app = TestApp::new();
    for template in templates() {
        let agent = app.services.agents.create(input(&template.id, &template.label)).unwrap();
        let skills = app.services.skills.list(&agent.id).unwrap();
        let mut names: Vec<_> = skills.iter().map(|skill| skill.name.clone()).collect();
        let mut expected = template.builtin_skills;
        names.sort();
        expected.sort();
        assert_eq!(names, expected);
        assert_eq!(skills.iter().any(|skill| skill.builtin_name() == Some("eli5")), template.id == "manager");
        assert!(skills
            .iter()
            .all(|skill| skill.problem.is_none()
                && skill.source == Some(SkillSource::Builtin { name: skill.name.clone() })));
    }
}

#[tokio::test]
async fn missing_ideator_skill_is_added_only_when_changing_role() {
    let app = TestApp::new();
    let agent = app.services.agents.create(input("ideator", "ヒラメ")).unwrap();
    let skills = app.services.skills.list(&agent.id).unwrap();
    let linked = skills.iter().find(|skill| skill.name == "introspection").unwrap();
    app.services.skills.delete(&linked.id).unwrap();
    app.services.agents.update(&agent.id, input("ideator", "名前変更")).unwrap();
    assert!(!app.services.skills.list(&agent.id).unwrap().iter().any(|skill| skill.name == "introspection"));
    app.services.agents.update(&agent.id, input("worker", "ヒラメ")).unwrap();
    app.services.agents.update(&agent.id, input("ideator", "ヒラメ")).unwrap();
    let skills = app.services.skills.list(&agent.id).unwrap();
    let linked = skills.iter().find(|skill| skill.name == "introspection").unwrap();
    assert_eq!(linked.source, Some(SkillSource::Builtin { name: "introspection".into() }));
}

#[tokio::test]
async fn role_changes_add_missing_skills_without_overwriting_or_readding_on_normal_save() {
    let app = TestApp::new();
    let agent = app.services.agents.create(input("ideator", "ヒラメ")).unwrap();
    let custom = app
        .services
        .skills
        .save(SkillInput {
            id: None,
            agent_id: agent.id.clone(),
            name: "universal-critique".into(),
            description: "自分用".into(),
            body: "独自の手順".into(),
        })
        .unwrap();
    app.services.agents.update(&agent.id, input("expert", "ヒラメ")).unwrap();
    let skills = app.services.skills.list(&agent.id).unwrap();
    assert_eq!(skills.len(), 4);
    assert!(skills.iter().any(|skill| skill.builtin_name() == Some("expert-collaboration")));
    assert_eq!(skills.iter().find(|skill| skill.name == "universal-critique"), Some(&custom));
    let critique = skills.iter().find(|skill| skill.name == "universal-critique").unwrap();
    app.services.skills.delete(&critique.id).unwrap();
    app.services.agents.update(&agent.id, input("expert", "名前変更")).unwrap();
    let skills = app.services.skills.list(&agent.id).unwrap();
    assert_eq!(skills.len(), 3, "通常の保存では外したスキルを復活させない");
    assert!(skills.iter().any(|skill| skill.name == "concept-shift"), "以前のスキルは保持する");
}

async fn request_for(app: &TestApp, agent: &Agent, channel: &Channel) -> RuntimeRequest {
    let previous = app.runtime.requests_for(agent.id.as_str()).len();
    app.runtime.script(agent.id.as_str(), reply("回答"));
    app.services
        .conversation
        .send_human_message(&channel.id, &format!("@{} 相談です", agent.name), &[])
        .unwrap_or_else(|error| panic!("相談を送れません: {error}"));
    app.settle().await;
    let mut requests = app.runtime.requests_for(agent.id.as_str());
    assert_eq!(requests.len(), previous + 1, "この相談で1回実行する");
    requests.swap_remove(previous)
}

#[tokio::test]
async fn expert_instructions_reach_every_backend_once_with_or_without_the_link() {
    let builtin = find_builtin_skill("expert-collaboration").unwrap();
    for backend in ["claude", "codex", "grok", "muse"] {
        let app = TestApp::new();
        *app.runtime.backends.lock() = vec![ready_backend(backend)];
        let mut input = input("expert", "相談役");
        input.backend = backend.into();
        input.consultable = false;
        input.can_delegate = true;
        let agent = app.services.agents.create(input).unwrap();
        let channel = app.channel("相談", &[&agent]);
        let links = app.services.skills.list(&agent.id).unwrap();
        let link = links.iter().find(|s| s.builtin_name() == Some(&builtin.name)).unwrap();
        for linked in [true, false] {
            if !linked {
                app.services.skills.delete(&link.id).unwrap();
            }
            for supports_skills in [true, false] {
                app.runtime.backends.lock()[0].capabilities.skills = supports_skills;
                let request = request_for(&app, &agent, &channel).await;
                assert_eq!(request.backend, backend);
                assert_eq!(request.system_prompt.matches(&builtin.body).count(), 1);
                assert!(!request.system_prompt.contains(&builtin.description));
                assert!(!request.system_prompt.contains("## 割り振りのしかた"));
                assert!(request.skills.iter().all(|s| s.name != builtin.name));
                assert_eq!(request.skills.iter().any(|s| s.name == "universal-critique"), supports_skills);
            }
        }
    }
}

#[tokio::test]
async fn leaving_expert_role_keeps_the_link_in_the_editor_only() {
    let app = TestApp::new();
    let builtin = find_builtin_skill("expert-collaboration").unwrap();
    let agent = app.services.agents.create(input("expert", "担当")).unwrap();
    let channel = app.channel("相談", &[&agent]);
    for role in ["worker", "ideator", "manager"] {
        let mut updated = input(role, &agent.name);
        updated.tags.push("専門家".into());
        let agent = app.services.agents.update(&agent.id, updated).unwrap();
        assert!(app.services.skills.list(&agent.id).unwrap().iter().any(|s| s.name == builtin.name));
        let request = request_for(&app, &agent, &channel).await;
        assert!(!request.system_prompt.contains(&builtin.body));
        assert!(request.skills.iter().all(|s| s.name != builtin.name));
    }
}

#[tokio::test]
async fn unedited_copy_is_deduplicated_but_custom_expert_skill_still_runs() {
    let app = TestApp::new();
    let agent = app.agent("expert", "相談役");
    let channel = app.channel("相談", &[&agent]);
    let copy = app.services.skills.add_builtin(&agent.id, "expert-collaboration", LibraryAddMode::Copy).unwrap();
    let request = request_for(&app, &agent, &channel).await;
    assert_eq!(request.system_prompt.matches(&copy.body).count(), 1);
    assert!(request.skills.is_empty());
    app.services
        .skills
        .save(SkillInput {
            id: Some(copy.id.clone()),
            agent_id: agent.id.clone(),
            name: "my-collaboration".into(),
            description: copy.description.clone(),
            body: copy.body.clone(),
        })
        .unwrap();
    let renamed = request_for(&app, &agent, &channel).await;
    assert_eq!(renamed.system_prompt.matches(&copy.body).count(), 1);
    assert!(renamed.skills.is_empty());
    let custom = app
        .services
        .skills
        .save(SkillInput {
            id: Some(copy.id),
            agent_id: agent.id.clone(),
            name: copy.name,
            description: "個別の専門手順".into(),
            body: "独自の手順".into(),
        })
        .unwrap();
    let request = request_for(&app, &agent, &channel).await;
    assert_eq!(request.system_prompt.matches(&copy.body).count(), 1);
    assert_eq!(request.skills.len(), 1);
    assert_eq!(request.skills[0].body, custom.body);
}
