//! UI・保存・実行が同じ役割の権限を使うことを、共有の実例で確かめる。
use super::support::{agent, backend, input, ALL};
use guild_domain::agent::PermissionKey;
use guild_domain::agent::{effective_permissions, normalize_agent_input, Permissions};
use guild_domain::backend::{BackendInfo, PermissionRule};
use serde::Deserialize;

#[derive(Deserialize)]
struct Case {
    name: String,
    tags: Vec<String>,
    backend: String,
    permissions: Permissions,
}

#[test]
fn role_permissions_follow_the_shared_examples() {
    let cases: Vec<Case> =
        serde_json::from_str(include_str!("../../../../../contracts/behavior/role-permissions.json")).unwrap();
    let snapshot: serde_json::Value =
        serde_json::from_str(include_str!("../../../../../contracts/ipc/snapshot.json")).unwrap();
    let backends: Vec<BackendInfo> = serde_json::from_value(snapshot["backends"].clone()).unwrap();
    for case in cases {
        let backend = backends.iter().find(|b| b.id == case.backend).unwrap();
        let mut raw = input("worker", "テスト");
        raw.tags = case.tags.clone();
        raw.backend = case.backend.clone();
        if case.backend == "ollama" {
            raw.backend_options.insert("enableTools".to_owned(), serde_json::json!(true));
        }
        raw.permissions = ALL;
        assert_eq!(normalize_agent_input(raw, Some(backend)).unwrap().permissions, case.permissions, "{}", case.name);
        let mut existing = agent("test", "worker", "テスト");
        existing.backend = case.backend.clone();
        if case.backend == "ollama" {
            existing.backend_options.insert("enableTools".to_owned(), serde_json::json!(true));
        }
        existing.tags = case.tags;
        existing.permissions = ALL;
        assert_eq!(effective_permissions(&existing, Some(backend)), case.permissions, "{}", case.name);
    }
}

#[test]
fn chained_dependencies_are_resolved_without_widening_access() {
    let mut info = backend("test");
    info.capabilities.run_commands = false;
    info.permission_rules = vec![
        PermissionRule { when: PermissionKey::WriteAnywhere, requires: vec![PermissionKey::WriteFiles] },
        PermissionRule { when: PermissionKey::WriteFiles, requires: vec![PermissionKey::RunCommands] },
    ];
    let effective = effective_permissions(&agent("test", "worker", "テスト"), Some(&info));
    assert!(!effective.write_anywhere && !effective.write_files && !effective.run_commands);
}

#[test]
fn ollama_requires_explicit_opt_in_and_a_tool_capable_model() {
    use guild_domain::backend::{ModelSpec, OptionSpec, OptionType};
    use serde_json::json;
    let mut info = backend("ollama");
    info.default_model = "small".to_owned();
    info.models = vec![ModelSpec {
        id: "small".to_owned(),
        label: "small".to_owned(),
        description: String::new(),
        efforts: vec![],
        default_effort: None,
        tools: Some(true),
    }];
    info.options = vec![OptionSpec {
        key: "enableTools".to_owned(),
        label: "tools".to_owned(),
        description: String::new(),
        value_type: OptionType::Boolean,
        choices: vec![],
        default: json!(false),
    }];
    let mut existing = agent("test", "worker", "テスト");
    existing.backend = "ollama".to_owned();
    existing.permissions = ALL;
    assert_eq!(effective_permissions(&existing, Some(&info)), Permissions::default());
    let mut raw = input("worker", "テスト");
    raw.backend = "ollama".to_owned();
    assert_eq!(normalize_agent_input(raw.clone(), Some(&info)).unwrap().permissions, Permissions::default());
    raw.backend_options.insert("enableTools".to_owned(), json!(true));
    assert_eq!(normalize_agent_input(raw.clone(), Some(&info)).unwrap().permissions, ALL);
    existing.backend_options = raw.backend_options.clone();
    assert_eq!(effective_permissions(&existing, Some(&info)), ALL);
    info.models[0].tools = Some(false);
    assert!(normalize_agent_input(raw, Some(&info)).is_err());
    assert_eq!(effective_permissions(&existing, Some(&info)), Permissions::default());
    assert_eq!(effective_permissions(&existing, None), Permissions::default());
}
