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
        raw.permissions = ALL;
        assert_eq!(normalize_agent_input(raw, Some(backend)).unwrap().permissions, case.permissions, "{}", case.name);
        let mut existing = agent("test", "worker", "テスト");
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
