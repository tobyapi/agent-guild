//! 契約の実例（contracts/ipc/*.json）を対応する型に読み込み、書き戻した JSON が元と値として一致することを検査する。

use std::fs;
use std::path::PathBuf;

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;

use guild_domain::activity::ActivityState;
use guild_domain::agent::{templates, AgentInput};
use guild_domain::boot::BootStatus;
use guild_domain::delegation::{Delegation, DelegationStatus, SubtaskStatus};
use guild_domain::error::CommandError;
use guild_domain::message::Message;
use guild_domain::skill::{BuiltinSkill, LibraryAddMode, Skill, SkillInput, SkillLibrary, SkillSource, SkillsChanged};
use guild_domain::snapshot::Snapshot;
use guild_domain::statistics::ChannelStatistics;
use guild_domain::storage::StorageInfo;

fn fixture(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../contracts/ipc").join(name);
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("{} を読めません: {e}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("{name} は JSON ではありません: {e}"))
}

fn assert_round_trip<T: DeserializeOwned + Serialize>(name: &str) {
    let original = fixture(name);
    let typed: T =
        serde_json::from_value(original.clone()).unwrap_or_else(|e| panic!("{name} を型に読み込めません: {e}"));
    let written = serde_json::to_value(&typed).unwrap_or_else(|e| panic!("{name} を書き戻せません: {e}"));
    assert_eq!(written, original, "{name} の書き戻しが元と一致しません");
}

#[test]
fn snapshot() {
    assert_round_trip::<Snapshot>("snapshot.json");
}

#[test]
fn channel_statistics() {
    assert_round_trip::<ChannelStatistics>("channel-statistics.json");
}

#[test]
fn agent_input() {
    assert_round_trip::<AgentInput>("agent-input.json");
}

#[test]
fn messages() {
    assert_round_trip::<Vec<Message>>("messages.json");
}

#[test]
fn skill_and_skill_input() {
    assert_round_trip::<Skill>("skill.json");
    assert_round_trip::<SkillInput>("skill-input.json");
}

#[test]
fn linked_skill_and_library() {
    assert_round_trip::<Skill>("skill-linked.json");
    assert_round_trip::<SkillLibrary>("skill-library.json");
    let linked: Skill = serde_json::from_value(fixture("skill-linked.json")).expect("Skill");
    assert!(matches!(linked.source, Some(SkillSource::Linked { .. })));
    let modes: Vec<LibraryAddMode> = serde_json::from_str(r#"["link", "copy"]"#).expect("LibraryAddMode");
    assert_eq!(modes, [LibraryAddMode::Link, LibraryAddMode::Copy]);
}

#[test]
fn builtin_skill_and_catalog() {
    assert_round_trip::<Skill>("skill-builtin.json");
    assert_round_trip::<Vec<BuiltinSkill>>("builtin-skills.json");
    let builtin: Skill = serde_json::from_value(fixture("skill-builtin.json")).expect("Skill");
    assert_eq!(builtin.builtin_name(), Some("code-review"));
}

#[test]
fn delegation() {
    assert_round_trip::<Delegation>("delegation.json");
    let delegation: Delegation = serde_json::from_value(fixture("delegation.json")).expect("Delegation");
    assert_eq!(delegation.status, DelegationStatus::Running);
    let statuses: Vec<SubtaskStatus> = delegation.subtasks.iter().map(|s| s.status).collect();
    assert_eq!(statuses, [SubtaskStatus::Done, SubtaskStatus::Failed]);
    let messages: Vec<Message> = serde_json::from_value(fixture("messages.json")).expect("Message[]");
    assert!(messages.iter().any(|m| m.delegation_id.as_ref() == Some(&delegation.id)), "発言が割り振りに結びつく");
}

#[test]
fn event_payloads() {
    assert_round_trip::<ActivityState>("activity-state.json");
    assert_round_trip::<SkillsChanged>("skills-changed.json");
}

#[test]
fn storage_and_boot() {
    assert_round_trip::<StorageInfo>("storage-info.json");
    assert_round_trip::<BootStatus>("boot-status-recovery.json");
}

#[test]
fn command_error() {
    assert_round_trip::<CommandError>("command-error.json");
}

#[test]
fn templates_in_the_snapshot_match_the_template_table() {
    let snapshot: Snapshot = serde_json::from_value(fixture("snapshot.json")).expect("Snapshot");
    assert_eq!(
        snapshot.templates,
        templates(),
        "フィクスチャの templates は guild-domain のテンプレート表と完全に一致すること"
    );
}
