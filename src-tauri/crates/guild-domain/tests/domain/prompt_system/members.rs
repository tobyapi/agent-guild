//! メンバー一覧に含めるバックエンド・モデル・エフォートの設定。

use guild_domain::backend::{BackendInfo, ModelSpec};

use super::{agents, backend, system_prompt_with_agents, system_prompt_with_backends};

fn catalog() -> BackendInfo {
    BackendInfo {
        label: "Claude".to_owned(),
        default_model: "default-model".to_owned(),
        models: vec![
            ModelSpec {
                id: "default-model".to_owned(),
                label: "Default model".to_owned(),
                description: String::new(),
                efforts: vec!["low".to_owned(), "high".to_owned()],
                default_effort: Some("low".to_owned()),
                tools: None,
            },
            ModelSpec {
                id: "fixed-model".to_owned(),
                label: "Fixed model".to_owned(),
                description: String::new(),
                efforts: Vec::new(),
                default_effort: None,
                tools: None,
            },
        ],
        ..backend("claude")
    }
}

#[test]
fn members_show_configured_backend_model_and_effort_only() {
    let mut members = agents();
    members[1].model = "custom-model".to_owned();
    members[1].backend_options.insert("effort".to_owned(), serde_json::json!("high"));
    members[1].backend_options.insert("apiKey".to_owned(), serde_json::json!("not-for-the-prompt"));
    let prompt = system_prompt_with_agents("haru", &[], "", &[backend("other"), catalog()], &members);
    let sora = prompt.lines().find(|line| line.starts_with("- @ソラ（")).unwrap_or_default();
    assert!(sora.contains("／バックエンド: Claude／モデル: custom-model／エフォート: high）"));
    assert!(!prompt.contains("not-for-the-prompt"), "ほかのバックエンド設定は一覧へ出さない");
}

#[test]
fn members_show_known_defaults_as_defaults() {
    let prompt = system_prompt_with_backends("haru", &[], "", &[catalog()]);
    assert!(prompt.contains("／バックエンド: Claude／モデル: 既定（default-model）／エフォート: 既定（low））"));
}

#[test]
fn members_use_the_selected_models_effort_support() {
    let mut members = agents();
    members[1].model = "fixed-model".to_owned();
    let prompt = system_prompt_with_agents("haru", &[], "", &[catalog()], &members);
    assert!(prompt.contains("／モデル: fixed-model／エフォート: 指定不可）"));

    members[1].model = "custom-model".to_owned();
    let prompt = system_prompt_with_agents("haru", &[], "", &[catalog()], &members);
    assert!(prompt.contains("／モデル: custom-model／エフォート: 既定（モデルに任せる））"));
}

#[test]
fn members_keep_configured_values_when_the_backend_is_unknown() {
    let mut members = agents();
    members[1].backend = "custom-backend".to_owned();
    members[1].model = "custom-model".to_owned();
    members[1].backend_options.insert("effort".to_owned(), serde_json::json!("high"));
    let prompt = system_prompt_with_agents("haru", &[], "", &[catalog()], &members);
    assert!(prompt.contains("／バックエンド: custom-backend／モデル: custom-model／エフォート: high）"));
}

#[test]
fn members_do_not_invent_a_default_effort() {
    let mut info = catalog();
    info.models[0].default_effort = None;
    let prompt = system_prompt_with_backends("haru", &[], "", &[info]);
    assert!(prompt.contains("／モデル: 既定（default-model）／エフォート: 既定（モデルに任せる））"));
}
