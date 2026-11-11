//! エージェント: 入力規則・名前の一意性・テンプレート・実効権限。

use guild_domain::agent::{
    effective_permissions, ensure_unique_name, find_template, normalize_agent_input, templates, Agent, PermissionKey,
    UnmentionedPolicy,
};
use guild_domain::backend::PermissionRule;
use guild_domain::ids::AgentId;

use super::support::{agent, backend, input, ALL};

#[test]
fn trims_and_accepts_a_valid_input() {
    let mut raw = input("worker", "  ハル ");
    raw.backend = " claude ".to_owned();
    let normalized = normalize_agent_input(raw, None).map(|i| (i.name, i.backend));
    assert_eq!(normalized, Ok(("ハル".to_owned(), "claude".to_owned())));
}

#[test]
fn rejects_invalid_names() {
    let too_long = "あ".repeat(33);
    for name in ["  ", "@ハル", "ハ＠ル", "ハ ル", "ハ\u{3000}ル", too_long.as_str()] {
        assert!(normalize_agent_input(input("worker", name), None).is_err(), "{name}");
    }
}

#[test]
fn rejects_short_intervals_and_missing_backend() {
    let mut fast = input("worker", "ハル");
    fast.autonomy_interval_min = 4;
    let error = normalize_agent_input(fast, None).expect_err("4分");
    assert_eq!(error.field(), Some("autonomyIntervalMin"));
    let mut no_backend = input("worker", "ハル");
    no_backend.backend = " ".to_owned();
    let error = normalize_agent_input(no_backend, None).expect_err("バックエンドなし");
    assert_eq!(error.field(), Some("backend"));
}

#[test]
fn role_permissions_replace_individual_settings_and_resolve_backend_rules() {
    let mut codex = backend("codex");
    codex.permission_rules =
        vec![PermissionRule { when: PermissionKey::WriteFiles, requires: vec![PermissionKey::RunCommands] }];
    let mut raw = input("worker", "ソラ");
    raw.permissions.run_commands = false;
    assert_eq!(normalize_agent_input(raw, Some(&codex)).unwrap().permissions, ALL);
    codex.capabilities.run_commands = false;
    let permissions = normalize_agent_input(input("worker", "ソラ"), Some(&codex)).unwrap().permissions;
    assert!(!permissions.write_files && !permissions.run_commands);
}

#[test]
fn restricted_roles_never_gain_outside_access_to_enable_commands() {
    let mut claude = backend("claude");
    claude.permission_rules =
        vec![PermissionRule { when: PermissionKey::RunCommands, requires: vec![PermissionKey::WriteAnywhere] }];
    for role in ["ideator", "expert", "manager"] {
        let mut raw = input(role, "ハル");
        raw.permissions = ALL;
        let permissions = normalize_agent_input(raw, Some(&claude)).unwrap().permissions;
        assert!(!permissions.run_commands && !permissions.write_anywhere && !permissions.web_fetch);
        assert!(permissions.write_files && permissions.read_files && permissions.skills);
    }
    assert_eq!(normalize_agent_input(input("worker", "ハル"), Some(&claude)).unwrap().permissions, ALL);
}

#[test]
fn autonomy_is_available_to_any_agent() {
    let mut expert = input("expert", "ロジカ");
    expert.autonomy_enabled = true;
    assert_eq!(normalize_agent_input(expert, None).map(|i| i.autonomy_enabled), Ok(true));
}

#[test]
fn names_are_unique_after_nfkc_and_case_folding() {
    let mut gone = agent("a2", "worker", "ソラ");
    gone.deleted_at = Some(1);
    let agents = vec![agent("a1", "worker", "Haru"), gone];
    assert!(ensure_unique_name("ｈａｒｕ", &agents, None, None).is_err());
    assert!(ensure_unique_name("HARU", &agents, Some(&AgentId::new("a1")), None).is_ok());
    assert!(ensure_unique_name("ソラ", &agents, None, None).is_ok(), "削除済みの名前は使える");
    assert!(ensure_unique_name("あなた", &agents, None, Some("あなた")).is_err(), "人間と同じ名前は不可");
}

#[test]
fn apply_keeps_identity_history_and_deletion() {
    let mut haru = Agent::new(AgentId::new("a1"), input("worker", "ハル"), 100);
    haru.last_autonomous_at = Some(500);
    haru.apply(input("expert", "ハル2"));
    assert_eq!((haru.id.as_str(), haru.created_at, haru.last_autonomous_at), ("a1", 100, Some(500)));
    assert_eq!((haru.name.as_str(), haru.consultable, haru.deleted_at), ("ハル2", true, None));
}

#[test]
fn templates_match_the_design_table() {
    let ids: Vec<String> = templates().into_iter().map(|t| t.id).collect();
    assert_eq!(ids, ["worker", "ideator", "expert", "manager"]);
    for template in templates() {
        assert_eq!(template.accent.as_deref(), Some(template.id.as_str()), "accent はテンプレート ID と同じ名前");
        assert_eq!(template.defaults.tags, vec![template.label.clone()]);
    }
    assert!(find_template("unknown").is_none());
}

#[test]
fn roles_start_with_their_fixed_permissions_and_response_policy() {
    let defaults = |id: &str| find_template(id).map(|t| t.defaults).unwrap();
    let (worker, expert, manager) = (defaults("worker"), defaults("expert"), defaults("manager"));
    assert_eq!(worker.permissions, ALL);
    let workspace_only =
        guild_domain::agent::Permissions { web_search: false, web_fetch: false, write_anywhere: false, ..ALL };
    assert_eq!(expert.permissions, guild_domain::agent::Permissions { read_anywhere: true, ..workspace_only });
    assert_eq!(manager.permissions, guild_domain::agent::Permissions { read_anywhere: true, ..workspace_only });
    assert_eq!((worker.unmentioned, worker.consultable), (UnmentionedPolicy::Answer, false));
    assert_eq!((expert.unmentioned, expert.consultable), (UnmentionedPolicy::Fallback, true));
    assert_eq!(
        (manager.unmentioned, manager.can_delegate, manager.consultable),
        (UnmentionedPolicy::Lead, true, false)
    );
    assert_eq!(templates().iter().filter(|t| t.defaults.can_delegate).count(), 1, "割り振れるのはマネージャーだけ");
    let ideator = defaults("ideator");
    assert_eq!(ideator.permissions, workspace_only);
    assert_eq!((ideator.unmentioned, ideator.consultable), (UnmentionedPolicy::Ignore, true));
    assert!(!ideator.can_delegate && !ideator.autonomy_enabled);
    assert!(templates().iter().all(|t| !t.defaults.autonomy_enabled), "勝手に会話を増やさない");
}

#[test]
fn effective_permissions_are_own_permissions_within_capabilities() {
    let sora = agent("sora", "worker", "ソラ");
    assert!(effective_permissions(&sora, None).run_commands);
    let mut info = backend("codex");
    let capabilities = &mut info.capabilities;
    capabilities.web_fetch = false;
    capabilities.run_commands = false;
    capabilities.write_anywhere = false;
    let effective = effective_permissions(&sora, Some(&info));
    assert!(!effective.web_fetch && !effective.run_commands, "バックエンドにない能力は使えない");
    assert!(!effective.write_anywhere);
    assert!(effective.write_files);
}
